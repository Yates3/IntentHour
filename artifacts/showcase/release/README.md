# Desktop release artifacts

The Windows x64 release package is generated locally by:

```powershell
npm.cmd run desktop:make
```

Generated files are intentionally ignored by Git and remain under:

```text
out/make/squirrel.windows/x64/
```

The future GitHub Release should upload:

- `IntentHour-Setup-1.0.0.exe`
- `SHA256SUMS.txt`
- `RELEASE_NOTES.md`

Status: package prepared locally; GitHub Release pending.
