import os
import sys
import json
import time
import queue
import sqlite3
import threading
import atexit
from datetime import datetime, timezone

# -----------------------------------------------------------------------------
# Dependency Self-Installation
# -----------------------------------------------------------------------------
def install_dependencies():
    import subprocess
    required = {'pynput', 'pystray', 'pillow'}
    installed = False
    for pkg in required:
        try:
            if pkg == 'pillow':
                import PIL
            else:
                __import__(pkg)
        except ImportError:
            print(f"Installing missing dependency: {pkg}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])
            installed = True
    if installed:
        print("Dependencies installed successfully. Restarting script to apply environment updates...")
        os.execv(sys.executable, [sys.executable] + sys.argv)

install_dependencies()

# Now import the installed packages
from pynput import mouse, keyboard
import pystray
from PIL import Image, ImageDraw
import tkinter as tk
from tkinter import ttk

# -----------------------------------------------------------------------------
# Configuration Setup
# -----------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")

def load_config():
    default_config = {
        "interval_minutes": 25,
        "db_path": "moodtrace.db"
    }
    if not os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "w") as f:
                json.dump(default_config, f, indent=4)
        except Exception as e:
            print(f"Warning: Could not create default config: {e}")
        return default_config
    
    try:
        with open(CONFIG_PATH, "r") as f:
            user_config = json.load(f)
            # Fill in missing default values
            for k, v in default_config.items():
                if k not in user_config:
                    user_config[k] = v
            return user_config
    except Exception as e:
        print(f"Warning: Error reading config.json, using defaults: {e}")
        return default_config

config = load_config()
db_path = config["db_path"]
if not os.path.isabs(db_path):
    db_path = os.path.normpath(os.path.join(SCRIPT_DIR, db_path))

interval_minutes = config["interval_minutes"]

def add_to_startup():
    try:
        # Check if we are on Windows
        if sys.platform != "win32":
            return
        
        startup_dir = os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup")
        lnk_path = os.path.join(startup_dir, "MoodTrace.lnk")
        if os.path.exists(lnk_path):
            return # Already in startup
            
        vbs_path = os.path.normpath(os.path.join(SCRIPT_DIR, "run_invisible.vbs"))
        if not os.path.exists(vbs_path):
            return
            
        # Run powershell command to create shortcut
        lnk_escaped = lnk_path.replace("\\", "/")
        vbs_escaped = vbs_path.replace("\\", "/")
        dir_escaped = SCRIPT_DIR.replace("\\", "/")
        
        ps_cmd = (
            f'$WshShell = New-Object -ComObject WScript.Shell; '
            f'$Shortcut = $WshShell.CreateShortcut("{lnk_escaped}"); '
            f'$Shortcut.TargetPath = "wscript.exe"; '
            f'$Shortcut.Arguments = "`"{vbs_escaped}`""; '
            f'$Shortcut.WorkingDirectory = "{dir_escaped}"; '
            f'$Shortcut.Save()'
        )
        import subprocess
        subprocess.run(["powershell", "-Command", ps_cmd], capture_output=True)
        print("MoodTrace added to Windows Startup successfully.")
    except Exception as e:
        print(f"Warning: Could not add to Windows Startup: {e}")

# -----------------------------------------------------------------------------
# Database Setup and Buffering Thread
# -----------------------------------------------------------------------------
event_queue = queue.Queue()

def get_utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def init_db(conn):
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS labels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_utc TEXT NOT NULL,
            valence REAL NOT NULL,
            arousal REAL NOT NULL,
            trigger TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS raw_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_utc TEXT NOT NULL,
            event_type TEXT NOT NULL,
            x INTEGER, y INTEGER,
            scroll_delta INTEGER,
            button TEXT
        )
    """)
    # Add indexes for speed when slicing windows
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_events_ts ON raw_events(ts_utc)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_labels_ts ON labels(ts_utc)")
    conn.commit()

def flush_buffer(conn, buffer):
    if not buffer:
        return
    cursor = conn.cursor()
    
    events_to_insert = []
    labels_to_insert = []
    
    for item in buffer:
        if item[0] == "EVENT":
            events_to_insert.append(item[1:])
        elif item[0] == "LABEL":
            labels_to_insert.append(item[1:])
            
    if events_to_insert:
        cursor.executemany("""
            INSERT INTO raw_events (ts_utc, event_type, x, y, scroll_delta, button)
            VALUES (?, ?, ?, ?, ?, ?)
        """, events_to_insert)
        
    if labels_to_insert:
        cursor.executemany("""
            INSERT INTO labels (ts_utc, valence, arousal, trigger)
            VALUES (?, ?, ?, ?)
        """, labels_to_insert)
        
    conn.commit()

def db_writer_worker():
    conn = sqlite3.connect(db_path)
    init_db(conn)
    
    buffer = []
    last_flush = time.time()
    
    while True:
        try:
            item = event_queue.get(timeout=1.0)
            if item == "QUIT":
                flush_buffer(conn, buffer)
                break
            buffer.append(item)
            if len(buffer) >= 100 or (time.time() - last_flush) >= 5.0:
                flush_buffer(conn, buffer)
                buffer = []
                last_flush = time.time()
        except queue.Empty:
            if buffer and (time.time() - last_flush) >= 5.0:
                flush_buffer(conn, buffer)
                buffer = []
                last_flush = time.time()
            continue
            
    conn.close()

# Start DB writer thread
db_thread = threading.Thread(target=db_writer_worker, daemon=True)
db_thread.start()

# -----------------------------------------------------------------------------
# Low-Level Input Hooks
# -----------------------------------------------------------------------------
def on_move(x, y):
    event_queue.put(("EVENT", get_utc_now(), "move", int(x), int(y), None, None))

def on_click(x, y, button, pressed):
    event_type = "click_down" if pressed else "click_up"
    event_queue.put(("EVENT", get_utc_now(), event_type, int(x), int(y), None, button.name.lower()))

def on_scroll(x, y, dx, dy):
    event_queue.put(("EVENT", get_utc_now(), "scroll", None, None, int(dy), None))

# Initialize listeners
mouse_listener = mouse.Listener(on_move=on_move, on_click=on_click, on_scroll=on_scroll)
mouse_listener.start()

# -----------------------------------------------------------------------------
# Trigger Popup Management (Queue-based for main thread execution)
# -----------------------------------------------------------------------------
trigger_popup_queue = queue.Queue()
is_popup_open = False
last_log_time = time.time()

def trigger_manual():
    trigger_popup_queue.put("manual")

hotkey_listener = keyboard.GlobalHotKeys({
    '<ctrl>+<alt>+m': trigger_manual
})
hotkey_listener.start()

# -----------------------------------------------------------------------------
# System Tray Integration
# -----------------------------------------------------------------------------
def generate_tray_icon():
    # Create an elegant 64x64 icon dynamically
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    dc = ImageDraw.Draw(image)
    
    # Outer neon border
    dc.ellipse((4, 4, 60, 60), fill=(30, 30, 46, 255), outline=(137, 180, 250, 255), width=3)
    
    # Stylized graph line (pulse/moodtrace)
    # Catppuccin Blue/Mauve style gradients
    points = [(16, 32), (24, 16), (32, 48), (40, 24), (48, 32)]
    dc.line(points, fill=(245, 194, 231, 255), width=3, joint="round")
    
    return image

tray_icon = None

def setup_tray():
    global tray_icon
    menu = pystray.Menu(
        pystray.MenuItem("Log Mood Now", lambda: trigger_popup_queue.put("manual")),
        pystray.MenuItem("Configure Interval", lambda: trigger_popup_queue.put("config")),
        pystray.MenuItem("Exit", lambda: trigger_popup_queue.put("QUIT"))
    )
    tray_icon = pystray.Icon("moodtrace", generate_tray_icon(), "MoodTrace Collector", menu)
    # Run detached in background thread
    tray_icon.run_detached()

setup_tray()

# -----------------------------------------------------------------------------
# Tkinter GUI (Affect Grid)
# -----------------------------------------------------------------------------
def run_tkinter_popup(trigger_type):
    global last_log_time
    
    root = tk.Tk()
    root.title("MoodTrace — Self-Report")
    root.configure(bg="#1e1e2e")
    root.resizable(False, False)
    
    # Dimensions and Centering
    w, h = 480, 530
    ws = root.winfo_screenwidth()
    hs = root.winfo_screenheight()
    x = (ws // 2) - (w // 2)
    y = (hs // 2) - (h // 2)
    root.geometry(f"{w}x{h}+{x}+{y}")
    
    # Force on top
    root.attributes("-topmost", True)
    root.focus_force()
    
    # Header Label
    header_lbl = tk.Label(
        root, 
        text="MoodTrace Self-Report", 
        font=("Segoe UI", 16, "bold"), 
        bg="#1e1e2e", 
        fg="#cdd6f4"
    )
    header_lbl.pack(pady=(15, 5))
    
    desc_lbl = tk.Label(
        root, 
        text="Click on the grid to locate your current emotional state.", 
        font=("Segoe UI", 10), 
        bg="#1e1e2e", 
        fg="#a6adc8"
    )
    desc_lbl.pack(pady=(0, 15))
    
    # Layout for Affect Grid: Cross Grid
    grid_frame = tk.Frame(root, bg="#1e1e2e")
    grid_frame.pack(pady=10)
    
    # Top label: High Energy
    top_lbl = tk.Label(grid_frame, text="High Energy (Arousal)", font=("Segoe UI", 9, "bold"), bg="#1e1e2e", fg="#bac2de")
    top_lbl.grid(row=0, column=1, pady=5)
    
    # Bottom label: Low Energy
    bottom_lbl = tk.Label(grid_frame, text="Low Energy (Arousal)", font=("Segoe UI", 9, "bold"), bg="#1e1e2e", fg="#bac2de")
    bottom_lbl.grid(row=2, column=1, pady=5)
    
    # Left label: Negative Mood
    left_lbl = tk.Label(grid_frame, text="Negative\nMood\n(Valence)", font=("Segoe UI", 9, "bold"), bg="#1e1e2e", fg="#bac2de", justify="center")
    left_lbl.grid(row=1, column=0, padx=10)
    
    # Right label: Positive Mood
    right_lbl = tk.Label(grid_frame, text="Positive\nMood\n(Valence)", font=("Segoe UI", 9, "bold"), bg="#1e1e2e", fg="#bac2de", justify="center")
    right_lbl.grid(row=1, column=2, padx=10)
    
    # Canvas for 2D Grid
    canvas = tk.Canvas(
        grid_frame, 
        width=250, 
        height=250, 
        bg="#313244", 
        highlightthickness=1, 
        highlightbackground="#89b4fa",
        cursor="crosshair"
    )
    canvas.grid(row=1, column=1)
    
    # Draw central crosshair (dashed)
    canvas.create_line(125, 0, 125, 250, fill="#45475a", dash=(4, 4))
    canvas.create_line(0, 125, 250, 125, fill="#45475a", dash=(4, 4))
    
    # Status Label
    status_lbl = tk.Label(
        root, 
        text="No selection made. Click anywhere on the grid.", 
        font=("Segoe UI", 10, "italic"), 
        bg="#1e1e2e", 
        fg="#a6adc8"
    )
    status_lbl.pack(pady=10)
    
    # State tracking
    selected_valence = None
    selected_arousal = None
    dot_id = None
    
    def on_grid_click(event):
        nonlocal selected_valence, selected_arousal, dot_id
        x_click, y_click = event.x, event.y
        # Clamp to canvas boundaries
        x_click = max(0, min(250, x_click))
        y_click = max(0, min(250, y_click))
        
        # Convert click coordinates to [-1.0, 1.0] range
        # Valence (X-axis): left is -1, right is 1
        selected_valence = (x_click - 125) / 125.0
        # Arousal (Y-axis): top is 1, bottom is -1
        selected_arousal = (125 - y_click) / 125.0
        
        # Render/Move glowing neon dot
        if dot_id is None:
            dot_id = canvas.create_oval(
                x_click - 6, y_click - 6, x_click + 6, y_click + 6, 
                fill="#f5c2e7", outline="#89b4fa", width=2
            )
        else:
            canvas.coords(dot_id, x_click - 6, y_click - 6, x_click + 6, y_click + 6)
            
        # Enable Submit Button
        submit_btn.config(state="normal", bg="#89b4fa", fg="#1e1e2e")
        
        # Describe state
        status_lbl.config(
            text=f"Valence: {selected_valence:+.2f} | Arousal: {selected_arousal:+.2f}",
            font=("Segoe UI", 10, "bold"),
            fg="#cdd6f4"
        )
        
    canvas.bind("<Button-1>", on_grid_click)
    canvas.bind("<B1-Motion>", on_grid_click)
    
    # Button Actions
    def on_submit():
        if selected_valence is not None and selected_arousal is not None:
            ts = get_utc_now()
            event_queue.put(("LABEL", ts, selected_valence, selected_arousal, trigger_type))
            root.destroy()
            
    def on_cancel():
        root.destroy()
        
    # Buttons frame
    btn_frame = tk.Frame(root, bg="#1e1e2e")
    btn_frame.pack(pady=10)
    
    submit_btn = tk.Button(
        btn_frame, 
        text="Submit", 
        width=12,
        font=("Segoe UI", 10, "bold"),
        bg="#45475a", 
        fg="#585b70",
        state="disabled",
        relief="flat",
        bd=0,
        padx=10,
        pady=5,
        command=on_submit
    )
    submit_btn.pack(side="left", padx=10)
    
    cancel_btn = tk.Button(
        btn_frame, 
        text="Cancel", 
        width=12,
        font=("Segoe UI", 10),
        bg="#313244", 
        fg="#cdd6f4",
        activebackground="#45475a",
        activeforeground="#cdd6f4",
        relief="flat",
        bd=0,
        padx=10,
        pady=5,
        command=on_cancel
    )
    cancel_btn.pack(side="left", padx=10)
    
    # Hover effects for active buttons
    def submit_enter(e):
        if submit_btn["state"] == "normal":
            submit_btn.config(bg="#b4befe")
            
    def submit_leave(e):
        if submit_btn["state"] == "normal":
            submit_btn.config(bg="#89b4fa")
            
    def cancel_enter(e):
        cancel_btn.config(bg="#45475a")
        
    def cancel_leave(e):
        cancel_btn.config(bg="#313244")
        
    submit_btn.bind("<Enter>", submit_enter)
    submit_btn.bind("<Leave>", submit_leave)
    cancel_btn.bind("<Enter>", cancel_enter)
    cancel_btn.bind("<Leave>", cancel_leave)
    
    # Keyboard bindings
    root.bind("<Return>", lambda e: on_submit() if selected_valence is not None else None)
    root.bind("<Escape>", lambda e: on_cancel())
    
    # Run the window loop
    root.mainloop()

# -----------------------------------------------------------------------------
# Clean Shutdown Sequence
# -----------------------------------------------------------------------------
def cleanup():
    print("Shutting down data collector...")
    # Stop low-level hooks
    try:
        mouse_listener.stop()
    except:
        pass
    try:
        hotkey_listener.stop()
    except:
        pass
        
    # Flush SQLite buffer
    event_queue.put("QUIT")
    db_thread.join(timeout=3.0)
    
    # Stop tray icon
    try:
        if tray_icon:
            tray_icon.stop()
    except:
        pass
    print("Data collector shutdown complete.")

atexit.register(cleanup)

# -----------------------------------------------------------------------------
# Configuration Popup GUI
# -----------------------------------------------------------------------------
def run_config_popup():
    global interval_minutes
    root = tk.Tk()
    root.title("MoodTrace — Configure")
    root.configure(bg="#1e1e2e")
    root.resizable(False, False)
    
    w, h = 320, 185
    ws = root.winfo_screenwidth()
    hs = root.winfo_screenheight()
    x = (ws // 2) - (w // 2)
    y = (hs // 2) - (h // 2)
    root.geometry(f"{w}x{h}+{x}+{y}")
    
    root.attributes("-topmost", True)
    root.focus_force()
    
    tk.Label(root, text="Configure Interval", font=("Segoe UI", 12, "bold"), bg="#1e1e2e", fg="#cdd6f4").pack(pady=(15, 10))
    tk.Label(root, text="Popup interval (minutes):", font=("Segoe UI", 10), bg="#1e1e2e", fg="#a6adc8").pack(pady=2)
    
    entry_var = tk.StringVar(value=str(interval_minutes))
    entry = tk.Entry(root, textvariable=entry_var, font=("Segoe UI", 10), bg="#313244", fg="#cdd6f4", insertbackground="#cdd6f4", bd=0, justify="center", width=10)
    entry.pack(pady=5)
    entry.focus()
    
    status_lbl = tk.Label(root, text="", font=("Segoe UI", 8), bg="#1e1e2e", fg="#f38ba8")
    status_lbl.pack()
    
    def on_save():
        global interval_minutes
        val_str = entry_var.get().strip()
        try:
            val = int(val_str)
            if val < 1:
                raise ValueError("Interval must be at least 1 minute.")
            
            config_data = load_config()
            config_data["interval_minutes"] = val
            with open(CONFIG_PATH, "w") as f:
                json.dump(config_data, f, indent=4)
                
            interval_minutes = val
            print(f"Interval updated to {val} minutes.")
            root.destroy()
        except ValueError as err:
            status_lbl.config(text=str(err) or "Invalid number")
            
    btn_frame = tk.Frame(root, bg="#1e1e2e")
    btn_frame.pack(pady=(10, 15))
    
    save_btn = tk.Button(btn_frame, text="Save", width=8, font=("Segoe UI", 9, "bold"), bg="#89b4fa", fg="#1e1e2e", activebackground="#b4befe", relief="flat", bd=0, command=on_save)
    save_btn.pack(side="left", padx=10)
    
    cancel_btn = tk.Button(btn_frame, text="Cancel", width=8, font=("Segoe UI", 9), bg="#313244", fg="#cdd6f4", activebackground="#45475a", activeforeground="#cdd6f4", relief="flat", bd=0, command=root.destroy)
    cancel_btn.pack(side="left", padx=10)
    
    root.bind("<Return>", lambda e: on_save())
    root.bind("<Escape>", lambda e: root.destroy())
    
    root.mainloop()

# -----------------------------------------------------------------------------
# Main Scheduler Loop
# -----------------------------------------------------------------------------
def main():
    global last_log_time, is_popup_open
    
    # Register with Windows Startup shortcut
    add_to_startup()
    
    print("MoodTrace Data Collector is active.")
    print("Press Ctrl+Alt+M to manually report your state.")
    print(f"Using SQLite Database: {db_path}")
    print(f"Scheduled popups occur every {interval_minutes} minutes.")
    
    # Start timer monitoring thread
    def check_timer():
        global last_log_time
        while True:
            time.sleep(5)
            elapsed = time.time() - last_log_time
            if elapsed >= interval_minutes * 60:
                trigger_popup_queue.put("scheduled")
                
    timer_thread = threading.Thread(target=check_timer, daemon=True)
    timer_thread.start()
    
    # Main loop consumes popup events safely on the main thread
    while True:
        try:
            cmd = trigger_popup_queue.get(timeout=1.0)
            if cmd == "QUIT":
                break
            elif cmd in ("manual", "scheduled"):
                if not is_popup_open:
                    is_popup_open = True
                    run_tkinter_popup(cmd)
                    is_popup_open = False
                    # Reset interval timer after a selection was answered or closed
                    last_log_time = time.time()
            elif cmd == "config":
                if not is_popup_open:
                    is_popup_open = True
                    run_config_popup()
                    is_popup_open = False
        except queue.Empty:
            continue
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()
