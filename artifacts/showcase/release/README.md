# Desktop release artifacts

The Windows x64 release package is generated locally by:

```powershell
npm.cmd run desktop:make
```

Generated files are intentionally ignored by Git and remain under:

```text
out/make/squirrel.windows/x64/
```

The [`desktop-v1.0.0` GitHub prerelease](https://github.com/Yates3/IntentHour/releases/tag/desktop-v1.0.0) contains:

- `IntentHour-Setup-1.0.0.exe`
- `SHA256SUMS.txt`
- `RELEASE_NOTES.md`

Status: published as a prerelease. The generated `out/` directory remains local and ignored by Git.
