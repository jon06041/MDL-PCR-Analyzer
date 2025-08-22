# Runtime Logging

We now write important debug/info logs to a rotating file and stdout.

- File location: `logs/qpcr_debug.log` (in the repo folder). If the project directory is not writable, it falls back to `/tmp/qpcr_debug.log`.
- Rotation: 5MB per file, keep last 5 files.
- Level: Controlled by `LOG_LEVEL` env var (default `INFO`). Use `DEBUG` for verbose.

Quick view commands:

```bash
# Follow the log in real time
tail -n 200 -F logs/qpcr_debug.log

# If fell back to /tmp
tail -n 200 -F /tmp/qpcr_debug.log
```

Key entries:
- `REDO pre-check probe` shows the per-well R² and vendor Cq before applying the rule.
- `REDO pre-check applied` confirms a REDO decision with the reason.
- `ML Analysis` / `ML Result` provide classification attempts and outcomes.
- `CQJ assignment` lines log per-channel CQJ values used downstream for CalcJ.

Set verbose logging:

```bash
export LOG_LEVEL=DEBUG
python3 app.py
```
