@echo off
title FV Exploration Radar
cd /d "%~dp0"
:: -X utf8 forces stdout to UTF-8 so the [ok]/[err] glyphs and any model
:: name with accents print cleanly on Windows cmd (cp1252 default).
::
:: This launches the interactive server on http://127.0.0.1:8767 and opens
:: a browser tab. To run a one-shot scan into a static radar.html instead,
:: use:  python -X utf8 scout.py
python -X utf8 server.py
