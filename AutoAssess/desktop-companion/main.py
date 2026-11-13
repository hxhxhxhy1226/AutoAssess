"""Desktop-only control surface: focused results, full settings and a recoverable tray entry."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import tkinter as tk
from tkinter import ttk

from bridge_server import BridgeError, DesktopBridge
from capture import CaptureController
from settings_model import PRESETS, STRATEGIES, TRAITS, SELECTORS, SettingsError, checked_settings, default_settings, should_load_settings


def initial_geometry(screen_width, screen_height):
    return min(540, max(430, screen_width - 80)), min(780, max(480, screen_height - 100))


def stop_if_capture_failed(state, result):
    if not result.requested or result.verified:
        return False
    view = state.view()
    pending = view.get("commands", [])
    active = view.get("snapshot", {}).get("running") or any(item["action"] in {"start", "resume", "apply"} for item in pending)
    if not view.get("connected") or not active or any(item["action"] == "stop" for item in pending):
        return False
    try:
        state.queue_command("stop")
    except BridgeError:
        return False
    return True


def can_hide_to_tray(available, closing=False):
    return bool(available and not closing)


class SettingsDraft:
    """Keep unsaved edits separate from authoritative settings arriving over the bridge."""
    def __init__(self):
        self.values = default_settings()
        self.dirty = False
        self.synced = False
        self.binding = None
        self.revision = -1

    def observe(self, view, *, confirmed=False):
        if not view.get("connected"):
            changed = self.binding is not None or self.synced or self.dirty
            self.__init__()
            return changed
        binding = (view.get("binding_serial", 0), (view.get("tab") or {}).get("id"), view.get("version"))
        changed_binding = binding != self.binding
        revision = view.get("settings_revision", -1)
        value = view.get("settings")
        if value is None:
            if changed_binding:
                self.__init__()
                self.binding = binding
                return True
            return False
        if should_load_settings(connected=True, dirty=self.dirty, revision=revision,
                                loaded_revision=self.revision, binding_changed=changed_binding, confirmed=confirmed):
            self.values = checked_settings(value)
            self.binding = binding
            self.revision = revision
            self.dirty = False
            self.synced = True
            return True
        return False


class DesktopPanel:
    def __init__(self, root, *, bridge=None, capture=None, smoke_report=None, tray=None):
        self.root = root
        self.bridge = bridge or DesktopBridge()
        self.capture = capture or CaptureController()
        self.smoke_report = smoke_report
        self.closing = self.closed = self.syncing = False
        self.last_ack_serial = 0
        self.local_note = self.capture_failure_note = ""
        self.last_view = {"connected": False, "snapshot": {}, "commands": []}
        self.draft = SettingsDraft()
        self.tray = tray
        self.tray_notice = "正在初始化托盘…"
        self.tool_hwnd = None
        self.tray_was_available = False
        self.settings_widgets = []
        self.scrollers = []
        self.protection = tk.BooleanVar(value=True)
        self.topmost = tk.BooleanVar(value=True)
        self.mode = tk.StringVar(value="manual")
        self.dwell = tk.StringVar(value="5")
        self.auto_next = tk.BooleanVar(value=True)
        self.preset = tk.StringVar(value="outgoing_engineer")
        self.strategy = tk.StringVar(value="positive")
        self.traits = {axis: tk.IntVar(value=PRESETS["outgoing_engineer"][1][axis]) for axis in TRAITS}
        self.selectors = {key: tk.StringVar(value="") for key in SELECTORS}
        self.root.title("离线性格助手 · v0.5.1")
        width, height = initial_geometry(self.root.winfo_screenwidth(), self.root.winfo_screenheight())
        self.root.geometry(f"{width}x{height}")
        self.root.minsize(430, 480)
        self.root.configure(bg="#f5f6fa")
        self.root.attributes("-topmost", True)
        self._build()
        for variable in [self.mode, self.dwell, self.auto_next, self.strategy, *self.selectors.values()]:
            variable.trace_add("write", self._config_edited)
        self.preset.trace_add("write", self._preset_edited)
        for variable in self.traits.values():
            variable.trace_add("write", self._custom_edited)
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.root.bind("<Map>", self._mapped, add="+")
        self.root.bind("<Unmap>", self._unmapped, add="+")
        self.root.bind("<MouseWheel>", self._mousewheel, add="+")
        self.bridge.start()
        self._start_tray()
        self.root.after_idle(self.apply_protection)
        self.root.after(150, self.apply_protection)
        self.root.after(100, self.poll)
        if smoke_report:
            self.root.after(700, self._write_smoke_report)

    @property
    def dirty(self):
        return self.draft.dirty

    def _build(self):
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure("TFrame", background="#f5f6fa")
        style.configure("TLabel", background="#f5f6fa", foreground="#263144", font=("Microsoft YaHei UI", 9))
        style.configure("Title.TLabel", font=("Microsoft YaHei UI", 18, "bold"))
        style.configure("Muted.TLabel", foreground="#788297", font=("Microsoft YaHei UI", 8))
        style.configure("TButton", font=("Microsoft YaHei UI", 9), padding=(10, 8), background="#e9eaf3", foreground="#45516b", borderwidth=0)
        style.map("TButton", background=[("active", "#dfe1ef")], foreground=[("disabled", "#abb1bf")])
        style.configure("Accent.TButton", background="#6656bd", foreground="white")
        style.map("Accent.TButton", background=[("active", "#5544aa"), ("disabled", "#c8c3df")], foreground=[("disabled", "#ffffff")])
        style.configure("TNotebook", background="#f5f6fa", borderwidth=0)
        style.configure("TNotebook.Tab", padding=(13, 9), font=("Microsoft YaHei UI", 9))
        style.map("TNotebook.Tab", background=[("selected", "#ffffff")], foreground=[("selected", "#6656bd")])
        style.configure("TCheckbutton", background="#f5f6fa", foreground="#45516b", font=("Microsoft YaHei UI", 9))
        style.configure("TRadiobutton", background="#f5f6fa", foreground="#45516b", font=("Microsoft YaHei UI", 9))
        shell = ttk.Frame(self.root, padding=(18, 15, 18, 12))
        shell.pack(fill="both", expand=True)
        header = ttk.Frame(shell)
        header.pack(fill="x", pady=(0, 4))
        ttk.Label(header, text="桌面助手", style="Title.TLabel").pack(side="left")
        ttk.Label(header, text="0.5.1", style="Muted.TLabel").pack(side="right")
        self.connection_label = ttk.Label(shell, text="等待浏览器连接", style="Muted.TLabel", wraplength=480)
        self.connection_label.pack(fill="x")
        self.capture_label = ttk.Label(shell, text="正在检查窗口采集属性…", style="Muted.TLabel", wraplength=480)
        self.capture_label.pack(fill="x", pady=(3, 12))

        footer = ttk.Frame(shell)
        footer.pack(side="bottom", fill="x", pady=(12, 0))
        self.config_label = ttk.Label(footer, text="连接后读取配置", style="Muted.TLabel", wraplength=340)
        self.config_label.pack(side="top", anchor="w", pady=(0, 7))
        actions = ttk.Frame(footer)
        actions.pack(fill="x")
        self.start_button = ttk.Button(actions, text="开始识别", style="Accent.TButton", command=lambda: self.command("start"))
        self.start_button.pack(side="left", fill="x", expand=True, padx=(0, 5))
        self.pause_button = ttk.Button(actions, text="暂停", command=self.pause_resume)
        self.pause_button.pack(side="left", padx=4)
        self.stop_button = ttk.Button(actions, text="停止", command=lambda: self.command("stop"))
        self.stop_button.pack(side="left", padx=4)
        self.apply_button = ttk.Button(actions, text="填本题", command=lambda: self.command("apply"))
        self.apply_button.pack(side="left", padx=(4, 0))

        self.notebook = ttk.Notebook(shell)
        self.notebook.pack(fill="both", expand=True)
        self.answer_tab = ttk.Frame(self.notebook, padding=12)
        self.settings_tab = ttk.Frame(self.notebook, padding=12)
        self.adapter_tab = ttk.Frame(self.notebook, padding=12)
        self.connection_tab = ttk.Frame(self.notebook, padding=12)
        for frame, name in [(self.answer_tab, "作答"), (self.settings_tab, "偏好设置"), (self.adapter_tab, "页面适配"), (self.connection_tab, "连接")]:
            self.notebook.add(frame, text=name)
        self._build_answer()
        self._build_settings()
        self._build_adapter()
        self._build_connection()
        self._load_form(default_settings())
        self.update_controls(self.last_view)

    def _build_answer(self):
        page = self.answer_tab
        page.columnconfigure(0, weight=1)
        for row in (4, 6, 8):
            page.rowconfigure(row, weight=1 if row != 8 else 2)
        metrics = ttk.Frame(page)
        metrics.grid(row=0, column=0, sticky="ew")
        self.count_label = ttk.Label(metrics, text="已填写  0", font=("Microsoft YaHei UI", 10, "bold"))
        self.count_label.pack(side="left")
        self.countdown_label = ttk.Label(metrics, text="倒计时  —", style="Muted.TLabel")
        self.countdown_label.pack(side="right")
        self.status_label = ttk.Label(page, text="在“连接”页复制连接码，绑定当前浏览器页面。", wraplength=460, foreground="#6656bd")
        self.status_label.grid(row=1, column=0, sticky="ew", pady=(8, 9))
        ttk.Label(page, text="当前题目", font=("Microsoft YaHei UI", 9, "bold")).grid(row=2, column=0, sticky="w")
        self.question_type = ttk.Label(page, text="", style="Muted.TLabel")
        self.question_type.grid(row=3, column=0, sticky="w")
        self.question_text = self._read_text(page, height=3)
        self.question_text.master.grid(row=4, column=0, sticky="nsew", pady=(4, 9))
        ttk.Label(page, text="选择结果", font=("Microsoft YaHei UI", 9, "bold")).grid(row=5, column=0, sticky="w")
        self.answer_text = self._read_text(page, height=2, background="#eeeaf9")
        self.answer_text.master.grid(row=6, column=0, sticky="nsew", pady=(4, 9))
        self.basis_label = ttk.Label(page, text="选择依据", font=("Microsoft YaHei UI", 9, "bold"))
        self.basis_label.grid(row=7, column=0, sticky="w")
        self.explanation_text = self._read_text(page, height=4)
        self.explanation_text.master.grid(row=8, column=0, sticky="nsew", pady=(4, 0))

    def _build_settings(self):
        save_row = ttk.Frame(self.settings_tab)
        save_row.pack(side="bottom", fill="x", pady=(10, 0))
        ttk.Label(save_row, text="保存后由浏览器确认生效", style="Muted.TLabel").pack(side="left")
        self.configure_button = ttk.Button(save_row, text="保存配置", style="Accent.TButton", command=self.configure)
        self.configure_button.pack(side="right")
        pages = ttk.Notebook(self.settings_tab)
        pages.pack(fill="both", expand=True)
        common = ttk.Frame(pages)
        ranking = ttk.Frame(pages, padding=8)
        answers = ttk.Frame(pages, padding=8)
        pages.add(common, text="常用")
        pages.add(ranking, text="描述排序")
        pages.add(answers, text="个人答案")
        form = self._scrollable(common)
        row = ttk.Frame(form)
        row.pack(fill="x", pady=(5, 8))
        self.auto_radio = ttk.Radiobutton(row, text="自动填写", value="auto", variable=self.mode)
        self.manual_radio = ttk.Radiobutton(row, text="手动辅助", value="manual", variable=self.mode)
        self.auto_radio.pack(side="left")
        self.manual_radio.pack(side="left", padx=(16, 0))
        self.settings_widgets.extend([self.auto_radio, self.manual_radio])
        row = ttk.Frame(form)
        row.pack(fill="x", pady=(0, 8))
        ttk.Label(row, text="填写后停留").pack(side="left")
        self.dwell_input = ttk.Spinbox(row, from_=1, to=120, textvariable=self.dwell, width=5)
        self.dwell_input.pack(side="left", padx=(8, 4))
        ttk.Label(row, text="秒").pack(side="left")
        auto = ttk.Checkbutton(form, text="核对选择后自动继续下一题", variable=self.auto_next)
        auto.pack(anchor="w", pady=(0, 12))
        self.settings_widgets.extend([self.dwell_input, auto])
        ttk.Label(form, text="性格偏好", font=("Microsoft YaHei UI", 9, "bold")).pack(anchor="w")
        preset_grid = ttk.Frame(form)
        preset_grid.pack(fill="x", pady=(6, 12))
        for index, (key, (name, _traits)) in enumerate(PRESETS.items()):
            button = ttk.Radiobutton(preset_grid, text=name, value=key, variable=self.preset)
            button.grid(row=index, column=0, sticky="w", pady=3)
            self.settings_widgets.append(button)
        ttk.Label(form, text="答题策略", font=("Microsoft YaHei UI", 9, "bold")).pack(anchor="w")
        strategy_grid = ttk.Frame(form)
        strategy_grid.pack(fill="x", pady=(6, 10))
        for index, (key, name) in enumerate(STRATEGIES.items()):
            button = ttk.Radiobutton(strategy_grid, text=name, value=key, variable=self.strategy)
            button.grid(row=index // 2, column=index % 2, sticky="w", padx=(0, 20), pady=3)
            self.settings_widgets.append(button)
        ttk.Label(form, text="五项倾向", font=("Microsoft YaHei UI", 9, "bold")).pack(anchor="w")
        ttk.Label(form, text="调整倾向或描述排序，会自动切换为自定义偏好。", style="Muted.TLabel", wraplength=410).pack(anchor="w", pady=(3, 5))
        traits = ttk.Frame(form)
        traits.pack(fill="x")
        traits.columnconfigure(1, weight=1)
        for index, (axis, name) in enumerate(TRAITS.items()):
            ttk.Label(traits, text=name).grid(row=index, column=0, sticky="w", padx=(0, 10))
            scale = tk.Scale(traits, from_=1, to=5, resolution=1, orient="horizontal", variable=self.traits[axis],
                             showvalue=True, background="#f5f6fa", foreground="#6656bd", highlightthickness=0,
                             troughcolor="#e3e4ec", activebackground="#c5bedc", borderwidth=0, sliderrelief="flat", length=200)
            scale.grid(row=index, column=1, sticky="ew")
            self.settings_widgets.append(scale)
        ttk.Label(form, text="性格自评没有统一正确答案；未知题仍按所选策略处理。", style="Muted.TLabel", wraplength=410).pack(anchor="w", pady=(10, 5))
        ttk.Label(ranking, text="每行一项，从最符合到最不符合；同级别名用 | 分隔。留空使用五项倾向。编辑后自动采用自定义偏好。", style="Muted.TLabel", wraplength=410).pack(fill="x", pady=(0, 7))
        self.ranking_text = self._editor(ranking)
        self.ranking_text.bind("<<Modified>>", lambda event: self._editor_edited(self.ranking_text, custom=True))
        ttk.Label(answers, text="每行：完整题干 => 选项文字。优先于预设和策略；可以留空。", style="Muted.TLabel", wraplength=410).pack(fill="x", pady=(0, 7))
        self.answers_text = self._editor(answers)
        self.answers_text.bind("<<Modified>>", lambda event: self._editor_edited(self.answers_text))

    def _build_adapter(self):
        bottom = ttk.Frame(self.adapter_tab)
        bottom.pack(side="bottom", fill="x", pady=(10, 0))
        self.adapter_save = ttk.Button(bottom, text="保存配置", style="Accent.TButton", command=self.configure)
        self.adapter_save.pack(side="right")
        form = self._scrollable(self.adapter_tab)
        ttk.Label(form, text="通常保持为空。只有内置识别无法确认当前题目时，再填写 CSS 选择器。", style="Muted.TLabel", wraplength=420).pack(fill="x", pady=(5, 10))
        for key, label in SELECTORS.items():
            ttk.Label(form, text=label).pack(anchor="w", pady=(8, 4))
            entry = ttk.Entry(form, textvariable=self.selectors[key])
            entry.pack(fill="x")
            self.settings_widgets.append(entry)
        ttk.Label(form, text="题目容器应限定当前题组；下一题控件仍需符合插件的导航校验。", style="Muted.TLabel", wraplength=420).pack(fill="x", pady=(12, 5))

    def _build_connection(self):
        form = self._scrollable(self.connection_tab)
        ttk.Label(form, text="浏览器连接", font=("Microsoft YaHei UI", 11, "bold")).pack(anchor="w", pady=(5, 7))
        ttk.Label(form, text="复制下方连接码，粘贴到扩展工具栏，并连接当前页面。", style="Muted.TLabel", wraplength=420).pack(fill="x")
        pair_row = ttk.Frame(form)
        pair_row.pack(fill="x", pady=(9, 12))
        self.code = tk.StringVar(value=self.bridge.pairing_code)
        ttk.Entry(pair_row, textvariable=self.code, state="readonly", font=("Consolas", 9)).pack(side="left", fill="x", expand=True, padx=(0, 7))
        ttk.Button(pair_row, text="复制", command=self.copy_code).pack(side="right")
        ttk.Separator(form).pack(fill="x", pady=(2, 14))
        ttk.Label(form, text="窗口", font=("Microsoft YaHei UI", 11, "bold")).pack(anchor="w", pady=(0, 8))
        ttk.Checkbutton(form, text="窗口采集排除", variable=self.protection, command=self.apply_protection).pack(anchor="w", pady=4)
        ttk.Checkbutton(form, text="窗口置顶", variable=self.topmost, command=lambda: self.root.attributes("-topmost", self.topmost.get())).pack(anchor="w", pady=4)
        self.capture_detail = ttk.Label(form, text="正在读取系统属性…", style="Muted.TLabel", wraplength=420)
        self.capture_detail.pack(fill="x", pady=(7, 6))
        ttk.Label(form, text="设置成功表示系统属性匹配，不代表所有截图或录屏方式都已经验证。", style="Muted.TLabel", wraplength=420).pack(fill="x")
        ttk.Separator(form).pack(fill="x", pady=16)
        ttk.Label(form, text="系统托盘", font=("Microsoft YaHei UI", 11, "bold")).pack(anchor="w")
        self.tray_label = ttk.Label(form, text=self.tray_notice, style="Muted.TLabel", wraplength=420)
        self.tray_label.pack(fill="x", pady=(8, 10))
        row = ttk.Frame(form)
        row.pack(fill="x")
        self.hide_button = ttk.Button(row, text="收起到托盘", command=self.hide_to_tray)
        self.hide_button.pack(side="left")
        ttk.Button(row, text="退出程序", command=self.request_exit).pack(side="right")
        ttk.Label(form, text="托盘可用时，关闭或最小化窗口会收起，任务继续。退出程序会先停止任务。折叠区位置由 Windows 管理。", style="Muted.TLabel", wraplength=420).pack(fill="x", pady=(10, 0))

    def _scrollable(self, parent):
        holder = ttk.Frame(parent)
        holder.pack(fill="both", expand=True)
        canvas = tk.Canvas(holder, background="#f5f6fa", highlightthickness=0, borderwidth=0)
        bar = ttk.Scrollbar(holder, orient="vertical", command=canvas.yview)
        bar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        canvas.configure(yscrollcommand=bar.set)
        content = ttk.Frame(canvas, padding=(0, 0, 10, 0))
        window = canvas.create_window(0, 0, window=content, anchor="nw")
        content.bind("<Configure>", lambda _event: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda event: canvas.itemconfigure(window, width=event.width))
        self.scrollers.append((content, canvas))
        return content

    def _mousewheel(self, event):
        if not event.delta or isinstance(event.widget, (tk.Text, tk.Scale, ttk.Spinbox, ttk.Entry)):
            return
        widget = event.widget
        while widget is not None:
            target = next((canvas for content, canvas in self.scrollers if content is widget), None)
            if target is not None:
                target.yview_scroll(-1 if event.delta > 0 else 1, "units")
                return
            widget = getattr(widget, "master", None)

    def _read_text(self, parent, *, height, background="#ffffff"):
        frame = ttk.Frame(parent)
        widget = tk.Text(frame, height=height, wrap="word", state="disabled", relief="flat", borderwidth=0, padx=10, pady=8,
                         background=background, foreground="#344158", font=("Microsoft YaHei UI", 10), highlightthickness=1, highlightbackground="#e6e8ef")
        bar = ttk.Scrollbar(frame, orient="vertical", command=widget.yview)
        widget.configure(yscrollcommand=bar.set)
        bar.pack(side="right", fill="y")
        widget.pack(side="left", fill="both", expand=True)
        widget._last_value = None
        return widget

    def _editor(self, parent):
        widget = self._read_text(parent, height=10)
        widget.master.pack(fill="both", expand=True)
        widget.configure(state="normal")
        self.settings_widgets.append(widget)
        return widget

    @staticmethod
    def set_text(widget, value):
        value = str(value or "")
        if widget._last_value != value:
            widget.configure(state="normal")
            widget.delete("1.0", "end")
            widget.insert("1.0", value)
            widget.configure(state="disabled")
            widget._last_value = value

    def _load_form(self, values):
        self.syncing = True
        try:
            self.mode.set(values["mode"])
            self.dwell.set(str(values["dwellSec"]))
            self.auto_next.set(values["autoNext"])
            self.preset.set(values["personalityPreset"])
            self.strategy.set(values["personalityStrategy"])
            defaults = PRESETS[values["personalityPreset"]][1]
            for axis, variable in self.traits.items():
                variable.set(values["personalityTraits"].get(axis, defaults[axis]) if values["personalityPreset"] == "custom" else defaults[axis])
            for key, variable in self.selectors.items():
                variable.set(values["selectors"].get(key, ""))
            for widget, key in [(self.ranking_text, "personalityRanking"), (self.answers_text, "personalityAnswers")]:
                widget.configure(state="normal")
                widget.delete("1.0", "end")
                widget.insert("1.0", values[key])
                widget.edit_modified(False)
        finally:
            self.syncing = False

    def _config_edited(self, *_args):
        if not self.syncing:
            self.draft.dirty = True
            if self.local_note.startswith("操作未完成："):
                self.local_note = ""
            self.config_label.configure(text="配置已修改，尚未保存")
            self.update_controls(self.last_view)

    def _preset_edited(self, *_args):
        if self.syncing:
            return
        key = self.preset.get()
        if key != "custom" and key in PRESETS:
            self.syncing = True
            try:
                for axis, variable in self.traits.items():
                    variable.set(PRESETS[key][1][axis])
            finally:
                self.syncing = False
        self._config_edited()

    def _custom_edited(self, *_args):
        if not self.syncing:
            self.preset.set("custom")
            self._config_edited()

    def _editor_edited(self, widget, custom=False):
        if not widget.edit_modified():
            return
        widget.edit_modified(False)
        if not self.syncing:
            self._custom_edited() if custom else self._config_edited()

    def desired_config(self):
        value = self.dwell.get().strip()
        if not value.isdigit():
            raise SettingsError("停留时间须为 1–120 秒整数")
        return checked_settings({"mode": self.mode.get(), "dwellSec": int(value), "autoNext": self.auto_next.get(),
            "personalityPreset": self.preset.get(), "personalityStrategy": self.strategy.get(),
            "personalityTraits": {axis: variable.get() for axis, variable in self.traits.items()},
            "personalityRanking": self.ranking_text.get("1.0", "end-1c"),
            "personalityAnswers": self.answers_text.get("1.0", "end-1c"),
            "selectors": {key: variable.get().strip() for key, variable in self.selectors.items()}})

    def configure(self):
        try:
            if not self.draft.synced:
                raise SettingsError("请先连接浏览器并等待完整配置同步")
            command = self.bridge.state.queue_command("configure", self.desired_config())
            self.local_note = "正在保存配置…"
            self.config_label.configure(text="正在等待浏览器确认配置")
            self.update_controls(self.bridge.state.view())
            return command
        except (BridgeError, SettingsError, tk.TclError) as error:
            self.local_note = str(error)
            self.config_label.configure(text=self.local_note)
            self.status_label.configure(text=self.local_note)

    def command(self, action):
        try:
            self.bridge.state.queue_command(action)
            self.local_note = {"start": "开始请求已发送…", "stop": "停止请求已发送…", "apply": "填写请求已发送…", "pause": "暂停请求已发送…", "resume": "继续请求已发送…"}[action]
            self.status_label.configure(text=self.local_note)
            self.update_controls(self.bridge.state.view())
        except BridgeError as error:
            self.local_note = str(error)
            self.status_label.configure(text=self.local_note)

    def pause_resume(self):
        self.command("resume" if self.last_view.get("snapshot", {}).get("paused") else "pause")

    @staticmethod
    def button_state(widget, enabled):
        widget.configure(state="normal" if enabled else "disabled")

    def update_controls(self, view):
        snapshot = view.get("snapshot") or {}
        connected = view.get("connected", False) and bool(snapshot) and not self.closing
        running, paused = snapshot.get("running", False), snapshot.get("paused", False)
        pending = bool(view.get("commands"))
        protection = view.get("capture", {})
        capture_ready = not protection.get("requested", True) or protection.get("verified", False)
        ready = connected and self.draft.synced
        self.button_state(self.start_button, ready and not running and not pending and not self.dirty and capture_ready)
        self.button_state(self.pause_button, connected and running and not pending)
        self.pause_button.configure(text="继续" if paused else "暂停")
        self.button_state(self.stop_button, connected)
        self.button_state(self.apply_button, ready and snapshot.get("canApply", False) and not running and not pending and not self.dirty and capture_ready)
        editable = ready and not running and not pending
        self.button_state(self.configure_button, editable and self.dirty)
        self.button_state(self.adapter_save, editable and self.dirty)
        for widget in self.settings_widgets:
            self.button_state(widget, editable)
        self.button_state(self.hide_button, self._tray_available() and not self.closing)

    def copy_code(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.code.get())
        self.connection_label.configure(text="连接码已复制，请粘贴到浏览器扩展")

    def _start_tray(self):
        try:
            from tray import TrayIcon
            icon = Path(__file__).with_name("assets") / "gear.ico"
            if icon.exists():
                try:
                    self.root.iconbitmap(str(icon))
                except tk.TclError:
                    pass
            if self.tray is None:
                self.tray = TrayIcon(icon, tooltip="离线性格助手")
            if not self.tray.start():
                raise RuntimeError(getattr(self.tray, "error", "托盘初始化失败"))
            self.tray_was_available = True
            self.tray_notice = "托盘已启用：双击齿轮图标打开，右键可停止或退出。图标是否折叠由 Windows 管理。"
        except (ImportError, OSError, RuntimeError, AttributeError) as error:
            self.tray_notice = "托盘暂不可用，窗口保留在任务栏。" + str(error)[:150]
            if self.tray:
                try:
                    self.tray.close()
                except Exception:
                    pass
            self.tray = None
        self.tray_label.configure(text=self.tray_notice)

    def _tray_available(self):
        return bool(self.tray and self.tray.available)

    def hide_to_tray(self):
        if can_hide_to_tray(self._tray_available(), self.closing):
            self.root.withdraw()
            return True
        self.tray_label.configure(text="托盘不可用，保留窗口以便继续操作。")
        return False

    def show_window(self):
        if not self.closed and not self.closing:
            self.root.deiconify()
            self.root.lift()
            self.root.after_idle(self.apply_protection)

    def _mapped(self, event):
        if event.widget is self.root and not self.closed:
            self.root.after_idle(self.apply_protection)
            self.root.after(100, self.apply_protection)

    def _unmapped(self, event):
        if event.widget is self.root and not self.closed and self._tray_available():
            try:
                if self.root.state() == "iconic":
                    self.root.after_idle(self.hide_to_tray)
            except tk.TclError:
                pass

    def apply_protection(self):
        if self.closed:
            return
        try:
            self.root.update_idletasks()
            result = self.capture.apply(self.root.winfo_id(), self.protection.get())
            if self._tray_available() and result.hwnd and result.hwnd != self.tool_hwnd:
                try:
                    from tray import set_tool_window
                    if set_tool_window(result.hwnd):
                        self.tool_hwnd = result.hwnd
                        result = self.capture.apply(self.root.winfo_id(), self.protection.get())
                except (ImportError, OSError, AttributeError):
                    pass
            self.bridge.state.set_capture(result.public())
            if result.requested and not result.verified:
                stopped = stop_if_capture_failed(self.bridge.state, result)
                self.capture_failure_note = "采集排除未生效" + ("，已请求停止" if stopped else "") + "：" + result.error
            else:
                self.capture_failure_note = ""
            if result.verified and result.requested:
                text, color = "采集排除已设置", "#417357"
                detail = "Windows 属性已回读匹配。具体截图、录屏方式仍需分别验收。"
            elif result.verified:
                text, color, detail = "采集排除已关闭", "#788297", "当前使用普通桌面窗口显示。"
            else:
                text, color, detail = "采集排除未生效", "#ad583f", result.error
            self.capture_label.configure(text=text, foreground=color)
            self.capture_detail.configure(text=detail, foreground=color)
            self.update_controls(self.bridge.state.view())
        except tk.TclError:
            return

    def poll(self):
        if self.closed:
            return
        if self._tray_available() and not self.tray_was_available:
            self.tray_was_available = True
            self.tray_notice = "托盘已恢复：双击齿轮图标打开，右键可停止或退出。"
            self.tray_label.configure(text=self.tray_notice)
            self.root.after_idle(self.apply_protection)
        if self.tray_was_available and not self._tray_available():
            if self.tool_hwnd:
                try:
                    from tray import set_tool_window
                    set_tool_window(self.tool_hwnd, enabled=False)
                except (ImportError, OSError, AttributeError):
                    pass
            self.tool_hwnd = None
            self.tray_was_available = False
            self.tray_notice = "托盘连接中断，已恢复窗口和任务栏入口。"
            self.tray_label.configure(text=self.tray_notice)
            self.show_window()
        if self.tray:
            for action in self.tray.drain():
                if action == "show":
                    self.show_window()
                elif action == "stop":
                    self.command("stop")
                elif action == "exit":
                    self.request_exit()
        view = self.bridge.state.view()
        snapshot = view.get("snapshot") or {}
        self.last_view = view
        ack = view.get("last_ack")
        confirmed = False
        if ack and ack["serial"] != self.last_ack_serial:
            self.last_ack_serial = ack["serial"]
            self.local_note = "" if ack["ok"] else "操作未完成：" + ack["error"]
            confirmed = ack["action"] == "configure" and ack["ok"]
        try:
            if self.draft.observe(view, confirmed=confirmed):
                self._load_form(self.draft.values)
        except SettingsError as error:
            self.local_note = "配置同步失败：" + str(error)
            self.draft.synced = False
        if not view.get("connected"):
            self.local_note = ""
            self.connection_label.configure(text="等待浏览器连接" if not self.closing else "正在退出…")
            self.count_label.configure(text="已填写  0")
            self.countdown_label.configure(text="倒计时  —")
            self.question_type.configure(text="")
            self.basis_label.configure(text="选择依据")
            for widget in [self.question_text, self.answer_text, self.explanation_text]:
                self.set_text(widget, "")
            self.status_label.configure(text="请在“连接”页复制连接码，绑定要操作的页面。" if not self.closing else "正在停止并退出…")
            self.config_label.configure(text="未连接；配置尚未读取")
        else:
            title = (view.get("tab") or {}).get("title") or "当前测评页面"
            self.connection_label.configure(text="已连接：" + title[:100])
            if snapshot:
                self.count_label.configure(text="已填写  " + str(snapshot["count"]))
                self.countdown_label.configure(text="倒计时  " + (snapshot["countdown"] or "—"))
                self.question_type.configure(text=snapshot["questionType"])
                self.basis_label.configure(text="选择依据 · " + (snapshot["basis"] or "离线规则"))
                self.set_text(self.question_text, snapshot["question"])
                self.set_text(self.answer_text, snapshot["answer"])
                self.set_text(self.explanation_text, snapshot["explanation"])
            if not view["commands"] and self.local_note.endswith("…"):
                self.local_note = ""
            self.status_label.configure(text=self.capture_failure_note or self.local_note or snapshot.get("status") or "已连接，等待页面状态。")
            if any(item["action"] == "configure" for item in view["commands"]):
                self.config_label.configure(text="正在等待浏览器确认配置")
            elif self.dirty:
                self.config_label.configure(text=self.local_note if self.local_note.startswith("操作未完成") else "配置已修改，尚未保存")
            elif not self.draft.synced:
                self.config_label.configure(text="等待完整配置；请确认扩展已更新到 0.5.1")
            else:
                self.config_label.configure(text="配置已与浏览器同步")
        self.update_controls(view)
        self.root.after(150, self.poll)

    def _write_smoke_report(self):
        if not self.smoke_report or self.closed:
            return
        data = {"title": self.root.title(), "mapped": bool(self.root.winfo_ismapped()), "geometry": self.root.geometry(),
                "capture": self.bridge.state.health()["capture"], "tray_available": self._tray_available(),
                "tabs": [self.notebook.tab(index, "text") for index in range(len(self.notebook.tabs()))],
                "note": "Native window property readback only; not screenshot, recording or tray placement acceptance."}
        Path(self.smoke_report).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.shutdown()

    def close(self):
        if self.closed or self.closing:
            return
        if not self.hide_to_tray():
            self.request_exit()

    def request_exit(self):
        if self.closed or self.closing:
            return
        self.closing = True
        try:
            self.bridge.state.queue_command("stop")
        except BridgeError:
            pass
        self.update_controls(self.bridge.state.view())
        self.status_label.configure(text="正在停止并退出桌面程序…")
        self.root.after(900, self.shutdown)

    def shutdown(self):
        if self.closed:
            return
        self.closed = True
        if self.tray:
            self.tray.close()
        self.bridge.close()
        self.root.destroy()


def main():
    parser = argparse.ArgumentParser(description="离线性格助手桌面窗口")
    parser.add_argument("--smoke-report", type=Path, help="Open briefly, record native property state, then exit")
    args = parser.parse_args()
    if sys.platform != "win32":
        raise SystemExit("桌面窗口的采集排除仅支持 Windows。")
    root = tk.Tk()
    try:
        panel = DesktopPanel(root, smoke_report=args.smoke_report)
        root.mainloop()
    finally:
        if "panel" in locals() and not panel.closed:
            panel.shutdown()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        Path(__file__).with_name("startup-error.log").write_text(traceback.format_exc(), encoding="utf-8")
        raise
