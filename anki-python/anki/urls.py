import yaml
import argparse
from pathlib import Path
import webbrowser


parser = argparse.ArgumentParser(description="Updates URLs yaml file")
parser.add_argument(
    "--src",
    dest="src",
    default=Path.home() / "Dropbox/_TRANSFER/URLs.yml",
    type=str,
    help="source urls file",
)
parser.add_argument(
    "--dest",
    dest="dest",
    default=Path.home() / "Dropbox/_TRANSFER/URLs_2.yml",
    help="YAML file to write to",
)
parser.add_argument(
    "--todo",
    dest="todo",
    default=Path.home() / "Dropbox/_TRANSFER/URLs_todo.yml",
    help="YAML file to write todo links to",
)
args = parser.parse_args()


def handle_urls(record):
    urls = []
    last_book = ""
    last_tags = ""
    for src in record["src"]:
        webbrowser.open(src, new=2)
        keep = input("Keep? [Y/n]")
        book = ""
        tags = ""
        if keep.lower() != "n":
            old_book = record["book"] if "book" in record else ""
            while not book:
                book = input(
                    f"Book? [{old_book or last_book}] or "
                    + "'might', 'explore', 'tools', 'idea', 'katas', 'knowledge', 'gallery'\n"
                )
                if not book:
                    book = old_book or last_book
                if book:
                    last_book = book

            old_tags = record["tags"] if "tags" in record else ""
            while not tags:
                tags = input(f"Tags? [{old_tags or last_tags}]\n")
                if not tags:
                    tags = old_tags or last_tags
                if tags:
                    last_tags = tags
            urls.append(
                {
                    "book": book,
                    "tags": tags,
                    "src": [src],
                }
            )
        tags = ""
        book = ""

    return urls


def main():
    how_many_records_todo = 3
    print(f"Called with: src: {args.src}, dest: {args.dest}, todo: {args.todo}")
    urls = yaml.load(open(args.dest), Loader=yaml.FullLoader)

    all_records = yaml.load(open(args.src), Loader=yaml.FullLoader)

    records_todo = all_records[0:how_many_records_todo]
    just_copy = all_records[how_many_records_todo:]

    for record in records_todo:
        urls = urls + handle_urls(record)

    with open(args.dest, "w") as f:
        f.write(yaml.dump(urls))

    with open(args.todo, "w") as f:
        f.write(yaml.dump(just_copy))

    print(f"Done\n\tcleaned up file {args.dest}\n\tstill to do {args.todo}")


if __name__ == "__main__":
    main()
