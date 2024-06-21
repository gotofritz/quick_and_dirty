"""
Loads a file exported by anki

"In SQL, INNER JOIN only returns rows where there is an actual join."
(FULL) OUTER JOIN returns all rows from both tables
geeky sql

and converts it to a file that can be used as input to cloze.py

>{tags: geeky sql}> In SQL, INNER JOIN only returns rows where there is
an actual join.  (FULL) OUTER JOIN returns all rows from
both tables ...


"""
import re
from pathlib import Path

from typer import run, Option
from typing import Optional


def main(
    src: str = Option(..., help="The file to be transformed"),
    target: Optional[str] = Option(
        default=None,
        help="The file where the cards will be saved",
    ),
):
    """
    Generate a GEEK.yml file which can then be fed to anki/main.py

    Usage:

    ❯ python -m anki.cloze_load --src ~/Desktop/cloze.txt

    Done 17 cards!

    # followed by

    ❯ python -m anki.cloze --src ~/Dropbox/_TRANSFER/anki/multiline.txt

    Done 17 cards!

    # followed by

    ❯ anki/main.py --src ~/Dropbox/_TRANSFER/anki/GEEK.yml --fields 2
    ...
    """

    lines = [line.strip() for line in open(src, "r").readlines() if line]
    cards = [re.split("\t+", card) for card in lines]
    lines = []
    for card in cards:
        processed_card = list(
            filter(
                lambda x: x,
                [
                    re.sub(
                        r" {2,}",
                        "",
                        re.sub(
                            r"</?strong>", "", re.sub(r"##.*$", "", field.strip(' "'))
                        ),
                    )
                    for field in card
                ],
            )
        )
        tags = processed_card.pop()
        processed_card[0] = f">{{tags: {tags}}}> " + processed_card[0]
        lines += processed_card

    if target is None:
        target = Path.home() / "Dropbox/_TRANSFER/anki/multiline.txt"
    with open(target, "w") as f:
        f.write("\n".join(lines))

    print(f"Done {len(cards)} cards in {target}!")


if __name__ == "__main__":
    run(main)
