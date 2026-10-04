# Background service

Routines run only while a Pitchcrew daemon is open. The background service starts the production daemon when you log in, so scheduled scans, reviews and other routines run without a terminal or a desktop window.

The service runs as your user, listens on 127.0.0.1 only and never needs administrator rights. It uses the operating system's own per-user service manager and no extra software.

## Before you install

- Build the UI with `pnpm build`. The service runs the built UI without `--dev`, so Demo and example loading are not available in it.
- Give each agent a real runtime in Crew. Production agents start paused.
- If you use your own data folder or port, set `PITCHCREW_HOME` and `PITCHCREW_PORT` in the shell before you install. Install saves the resolved folder and port in the service definition.
- Run the commands in the Pitchcrew checkout. The definition uses absolute paths to the current Node executable and this checkout. Run `pnpm service install` again after you move the checkout or change Node versions.

## Commands

| Command                  | What it does                                                                     |
| ------------------------ | -------------------------------------------------------------------------------- |
| `pnpm service install`   | Writes and registers the service, then starts the daemon                         |
| `pnpm service status`    | Shows whether it is installed, starts at login and is running; `--json` for data |
| `pnpm service start`     | Starts the background daemon now                                                 |
| `pnpm service stop`      | Stops the background daemon until your next login or `pnpm service start`        |
| `pnpm service logs`      | Prints recent log lines; `--lines 500` shows more                                |
| `pnpm service uninstall` | Stops the daemon and removes everything install created                          |

Install is safe to run again. With the same settings it leaves a running daemon alone. With new settings, such as another port, it rewrites the definition and restarts the daemon. There is one background service per user account, so installing for another data folder moves the service there.

Uninstall removes the service definition, the Task Scheduler file and the service logs in `background-service` inside the data folder. Your board, profile, chats and packets stay.

Settings > Local data shows whether the service is installed and running, whether it started the daemon you are using, and the commands to install or remove it. Installing and removing stay commands you run yourself.

## How it runs on each system

### Windows

Install registers a Task Scheduler task named `Pitchcrew` with `schtasks /Create /XML`. Its logon trigger and principal name only your account, with a limited token and the interactive logon type. Task Scheduler accepts that task without administrator rights, and the daemon runs in your logon session with your usual environment and sign-ins.

Task Scheduler is used because it is the built-in per-user mechanism that can start a program at logon and restart it after a failure. A Windows service needs administrator rights. The Run registry key and the Startup folder cannot restart a daemon that stops.

- The action runs `conhost.exe --headless` with Node, so no console window opens.
- The task restarts after a failure every minute, up to 999 times. It has no time limit and runs on battery power.
- Task Scheduler expands `%NAME%` in arguments, so install refuses paths that contain a percent sign.
- The task definition is saved as `background-service\pitchcrew-task.xml` in the data folder.
- `pnpm service stop` ends the task. If the daemon does not exit within ten seconds, it is stopped directly.

### macOS

Install writes `~/Library/LaunchAgents/local.pitchcrew.daemon.plist` and loads it with `launchctl bootstrap gui/<uid>`.

- `RunAtLoad` starts the daemon at login. `KeepAlive` restarts it after a failed exit, at most every 30 seconds.
- `pnpm service stop` unloads the agent with `launchctl bootout`. It loads again at your next login.
- launchd output goes to `background-service/launchd.log` in the data folder. It holds startup errors and is emptied when it passes 5 MB.
- macOS may show a "Background items added" notice. The item can be turned off in System Settings > General > Login Items.

### Linux

Install writes a systemd user unit to `~/.config/systemd/user/pitchcrew.service`, or under `$XDG_CONFIG_HOME` when it is set, and enables it with `systemctl --user enable --now`.

- `Restart=on-failure` restarts the daemon 30 seconds after a failure.
- User services run while you are logged in. To keep the daemon running after you log out, run `loginctl enable-linger`. Some systems ask for approval for that command; it is optional.
- Startup output before the daemon log opens is kept by the journal.

## Environment

launchd and systemd start services with a short default `PATH`. On macOS and Linux, install copies the `PATH` of the shell you install from, with the Node folder first and package-script folders such as `node_modules/.bin` removed, so runtime CLIs can be found. Windows tasks use your normal environment.

No other variable is copied into a service definition. Provider API keys stay out of it:

- A runtime that reads an API key from the environment needs the variable in the service manager's environment, or the CLI's own sign-in.
- Enter a Google Desktop OAuth client in **Connect Google Workspace** instead of `PITCHCREW_GOOGLE_CLIENT_ID`.
- `PITCHCREW_SEED_SKILLS=0` does not apply to the service. It loads missing starter skills like a normal start.

## One daemon per data folder

A daemon writes `daemon.lock` to its data folder while it runs. A second daemon for the same folder refuses to start before it opens the board, so it cannot mark the first daemon's runs as interrupted. A daemon also refuses a port where another Pitchcrew daemon answers. A lock left by a crash or a restart is replaced automatically.

The background service waits instead of failing. It checks every 15 seconds and starts as soon as the other daemon stops. `pnpm service status` reports that it is waiting.

## Desktop window

`pnpm desktop` and `pnpm desktop:prod` reuse a running daemon, including one started by the service. When no daemon is running and the service is installed for the same data folder and port, the launcher starts the service and waits for it. Otherwise it starts its own daemon.

The launcher stops only a daemon it started itself. Closing the window never stops the background service. While the service runs, `pnpm desktop` shows the production daemon, so Demo is not available.

## Logs

The service daemon writes to `background-service/daemon.log` in the data folder. When the file reaches 5 MB it moves to `daemon.log.1`, replacing the older copy, so the logs use at most about 10 MB. `pnpm service logs` prints the newest lines from both files.

## Troubleshooting

Start with `pnpm service status` and `pnpm service logs`.

- **"Build the UI first"**: run `pnpm build`, then install again.
- **The service waits for another daemon**: close the other daemon, for example a `pnpm start` terminal. The service starts within 15 seconds.
- **A runtime is unavailable only in the service**: reinstall from a shell where the CLI runs, so `PATH` includes it.
- **It stopped after a Node upgrade or a moved checkout**: run `pnpm service install` again.
- **To see startup errors directly**: run `pnpm service stop`, then `pnpm start` with the same `PITCHCREW_HOME` and `PITCHCREW_PORT`.

### Windows

- Open Task Scheduler, select **Task Scheduler Library > Pitchcrew** and check **Last Run Result** and **History**. History can be turned on from the Actions pane.
- `schtasks /Query /TN Pitchcrew /V /FO LIST` prints the task in a terminal.
- If `schtasks /Create` is refused, an administrator policy may block scheduled tasks for your account. Start Pitchcrew with `pnpm start` instead.
- If a console window appears at login, your Windows build may not support `conhost --headless`.

### macOS

- `launchctl print gui/$(id -u)/local.pitchcrew.daemon` shows the state, process and last exit code.
- If it never starts at login, check that it is allowed in System Settings > General > Login Items.

### Linux

- `systemctl --user status pitchcrew.service` and `journalctl --user -u pitchcrew.service` show the state and startup output.
- "Failed to connect to bus" means there is no systemd user session, as in some containers and WSL setups without systemd. Turn on systemd for the session or use `pnpm start`.

## Limits

- The service does not wake a sleeping computer. Routines that come due while it sleeps follow the usual rules: repeats coalesce into one overdue run.
- Automated tests check the generated definitions and commands against a simulated service manager. They never call schtasks, launchctl or systemctl.
