import pytest
from shutil import copy2 as copy
from pathlib import Path

from typer.testing import CliRunner

from bank.main import app


runner = CliRunner()

FIXTURE_CSV = "tests/fixtures/umsatz-4208________4365-20230407.CSV"


def test_app(tmp_path):
    src_path = tmp_path / "dir"
    src_path.mkdir()
    copy(FIXTURE_CSV, src_path / "one.csv")
    target_path = tmp_path / "upload_me.csv"
    result = runner.invoke(app, ["--src", src_path, "--target", target_path])
    assert result.exit_code == 0
    assert "1 file(s) generated" in result.stdout
