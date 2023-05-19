import yaml
import argparse
from pathlib import Path
import webbrowser
import re
import subprocess


def write_to_clipboard(output):
    process = subprocess.Popen(
        "pbcopy", env={"LANG": "en_GB.UTF-8"}, stdin=subprocess.PIPE
    )
    process.communicate(output.encode("utf-8"))


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
parser.add_argument(
    "--number",
    dest="n",
    default=8,
    type=int,
    help="How many links to do",
)
args = parser.parse_args()


run = True

discarded = 0
duplicates_ignored = 0
duplicates = []


def handle_input(prompt: str):
    """Wrap input with the ability to quite gracefully."""
    global run

    QUIT = "---"
    user_text = input(prompt)
    if user_text == QUIT:
        run = False
        return None
    return user_text


def handle_urls(record):
    def get_book(old_book):
        nonlocal last_book
        global run
        book = ""
        while not book:
            book = handle_input(
                f"Book? [{old_book or last_book}] or "
                + "'might', 'explore', 'tools', 'idea', 'interesting', 'katas', 'knowledge', 'gallery'\n"
            )
            if not run:
                break
            if not book:
                book = old_book or last_book
            if book:
                last_book = book
        return book

    def get_tags(old_tags):
        nonlocal last_tags
        tags = ""
        while not tags:
            tags = handle_input(f"Tags? [{old_tags or last_tags}]\n")
            if not run:
                break
            if not tags:
                tags = old_tags or last_tags
            if tags:
                last_tags = tags
        return tags

    global discarded
    global duplicates_ignored
    global duplicates
    global run

    urls = []
    last_book = ""
    last_tags = ""
    for src in record["src"]:
        if not run:
            break
        if src in duplicates:
            duplicates_ignored += 1
            continue
        display_tags = re.sub(r"[, ]+", " ", record["tags"])
        print(f"{record['i']}] BOOK: {record['book']}\t\nTAGS: {display_tags}")
        write_to_clipboard(display_tags)
        webbrowser.open(src, new=2, autoraise=False)
        keep = handle_input("Keep? [Y/n]")
        if not run:
            break
        if keep.lower() == "n":
            discarded += 1
        else:
            book = tags = ""
            while book == tags:
                book = get_book(record.get("book", ""))
                tags = get_tags(record.get("tags", ""))

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
    global discarded
    global duplicates
    global duplicates_ignored
    global run

    how_many_records_todo = args.n
    print(
        f"Called with: src: {args.src}, dest: {args.dest}, todo: {args.todo}, number: {args.n}"
    )
    urls = yaml.load(open(args.dest), Loader=yaml.FullLoader)
    duplicates = {url for record in urls for url in record["src"]}

    all_records = yaml.load(open(args.src), Loader=yaml.FullLoader)

    records_todo = all_records[0:how_many_records_todo]
    just_copy = all_records[how_many_records_todo:]

    MAX_LINKS = 8

    i = 0
    while len(records_todo):
        record = records_todo.pop(0)
        if isinstance(record["src"], str):
            record["src"] = [record["src"]]
        if len(record["src"]) > MAX_LINKS:
            new_record = {
                "book": record.get("book", ""),
                "tags": record.get("tags"),
                "src": record["src"][MAX_LINKS:],
            }
            just_copy.append(new_record)
            del record["src"][MAX_LINKS:]

        urls = [
            url
            for url in handle_urls({"i": i} | record)
            if url["book"] != "delete" and url["tags"] != "delete"
        ] + urls
        if not run:
            just_copy = [record] + records_todo + just_copy
            break
        i += 1

    with open(args.dest, "w") as f:
        f.write(yaml.dump(urls))

    with open(args.todo, "w") as f:
        f.write(yaml.dump(just_copy))

    print(
        "Done"
        + f"\n\t{len(urls)} cleaned up files in {args.dest}"
        + f"\n\t{discarded} discarded"
        + f"\n\t{duplicates_ignored} duplicates"
        + f"\n\t{len(just_copy)} still to do in {args.todo}"
    )


if __name__ == "__main__":
    main()
