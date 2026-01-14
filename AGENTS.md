# Agent Memory & Performance
## Lessons Learned
- **[2026-01-14]**: System initialized.
- **[2026-01-14]**: In GitHub Actions, writing step outputs to files using `echo` can be unreliable as it may interpret special characters. Using `printf '%s' "$VAR"` is a more robust method to ensure file contents are written literally and without modification. This prevents potential corruption of multi-line strings or text containing backslashes.