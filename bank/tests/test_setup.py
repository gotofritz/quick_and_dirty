import re

from bank import __version__ as version


def test_version(fake):
    """Sanity check that there is a version in the right place"""
    assert re.match(r"^\d+\.\d+\.\d+$", version)
    assert fake.pystr() != version
