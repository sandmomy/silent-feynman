@echo off
title FV Exploration Radar
cd /d "%~dp0"
:: -X utf8 forces stdout to UTF-8 so the [ok]/[err] glyphs and any
:: model name with accents print cleanly on Windows cmd (cp1252 default).
python -X utf8 scout.py %*
