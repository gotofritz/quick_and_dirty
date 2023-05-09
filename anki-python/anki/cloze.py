"""
Convert this format

>{tags: geeky sql}> In SQL, INNER JOIN only returns rows where there is an actual join.
{{|In SQL, }}(FULL) OUTER JOIN returns all rows from both tables
...

to a list of cards in GEEK.yml

"""
import re
import yaml
from pathlib import Path

from typer import run, Option
from typing import List


def _clean_line(line: str) -> str:
    """Remove everything we want to ignore."""
    line = re.sub(r"#.*\n$", "\n", line)
    return line.strip()


def _is_empty_line(line: str) -> bool:
    """Detect whether a previously cleaned line is now empty."""
    return line == "\n"


def _starts_new_batch(line: str) -> bool:
    """Detect character that resets the job."""
    return line[0] == ">"


def _first_line_of_new_batch(line: str) -> str:
    """Remove whatever it was that signaled 'new batch'."""
    return re.sub(r"^>({[^}]+\}>)? *", "", line)


def _replace_line_specific(position: int, line: str) -> str:
    def pick_one(match_obj):
        return match_obj.group(position)

    matcher = re.compile(r"\{\{(.*?)\|(.*?)\}\}")
    return matcher.sub(pick_one, line)


def _tags_for_batch(line: str, tags: list[str] | None) -> list[str]:
    """Extract tags from 1st line of new batch, or return globals"""
    potential_tags = re.match(r">\{[ :a-z,]*tags:([a-z-.0-9 ]+)(,[ :a-z]+)*\}>", line)
    if not potential_tags:
        return tags
    return potential_tags.group(1).strip().split(" ")


def main(
    src: str = Option(..., help="The file to be transformed"),
    target: str = Option(
        "",
        help="The file where the cards will be saved",
    ),
    tags: List[str] = Option(  # noqa B008
        ["geeky"], help="The string(s) that will appear in the changelog"
    ),
):
    """
    Generate a GEEK.yml file which can then be fed to anki/main.py

    Usage:

    ❯ python -m anki.cloze --src ~/Dropbox/_TRANSFER/anki/multiline.txt

    Done 17 cards!

    ❯ anki/main.py --src ~/Dropbox/_TRANSFER/anki/GEEK.yml --fields 2
    ...
    """

    global_tags = [tag for tag_string in tags for tag in tag_string.split(" ")]

    jobs = []

    with open(src, "r") as f:
        current_batch = []
        current_tags = global_tags.copy()
        for line in f.readlines():
            cleaned_line = _clean_line(line)
            if _is_empty_line(cleaned_line):
                continue
            if _starts_new_batch(line):
                if current_batch:
                    jobs.append(
                        {"batch": current_batch, "batch_tags": current_tags.copy()}
                    )
                current_batch = []
                current_tags = _tags_for_batch(cleaned_line, global_tags)
                cleaned_line = _first_line_of_new_batch(cleaned_line)
            current_batch.append(cleaned_line)
        jobs.append({"batch": current_batch, "batch_tags": current_tags})

    target_cards = []
    for job in jobs:
        batch, batch_tags = job.values()
        if len(batch) == 1:
            question = re.sub(r"\s+", " ", batch[0]).strip()
            target_cards.append(
                {
                    "question": [question],
                    "answers": [],
                    "tags": batch_tags.copy(),
                }
            )
        else:
            for i in range(len(batch) - 1):
                question = (
                    _replace_line_specific(2, batch[i])
                    + " "
                    + _replace_line_specific(1, batch[i + 1])
                )
                question = re.sub(r"\s+", " ", question).strip()
                target_cards.append(
                    {
                        "question": [question],
                        "answers": [],
                        "tags": batch_tags.copy(),
                    }
                )

    if target == "":
        target = Path.home() / "Dropbox/_TRANSFER/anki/GEEK.yml"
    else:
        target = Path(target)
    with open(target, "w") as f:
        f.write(yaml.dump(target_cards, sort_keys=False))

    print(f"Done {len(target_cards)} cards in {target}!")


if __name__ == "__main__":
    run(main)
