#!/usr/bin/env python
import argparse
import markdown
import re
import yaml

DEFAULT_TAGS = "geeky "
FIELDS_QUESTION = 2
FIELDS_ANSWERS = 12
CONFIG_FIELDS = ["noNumber"]


yaml.reader.Reader.NON_PRINTABLE = re.compile(
    "[^\x09\x0A\x0D\x20-\x7E\x85\xA0-\uD7FF\uE000-\uFFFD\U00010000-\U0010FFFF]"
)
parser = argparse.ArgumentParser(description="Creates importable anki files")
parser.add_argument(
    "--fields",
    dest="fields",
    default=17,
    type=int,
    help="How many total fields the card expects",
)
parser.add_argument("--src", dest="src", required=True, help="Text file to scan")
parser.add_argument(
    "--dest", dest="dest", default="anki.txt", help="Text file to write to"
)
parser.add_argument(
    "--tags",
    dest="tags",
    default=DEFAULT_TAGS,
    help="Tags to add to defaut (default: geeky)",
)
parser.add_argument("--debug", dest="debug", action="store_true", help="boolean")
args = parser.parse_args()

new_card_template = [""] * args.fields
new_card_template.append(args.tags)
md = markdown.Markdown(output_format="html5")
md_start_p = len("<p>")
md_end_p = len("</p>")


def write_card_to_file(the_card, the_file):
    card_as_string = "\t".join(the_card)
    the_file.write(card_as_string + "\n")


def process_normal_field(field):
    # sadly markdown wraps everything in <p>...</p>
    # we take the substring inside those.
    # additionally VSC wraps in stupid newlines, so we get rid of those
    try:
        return md.convert(field)[md_start_p:-md_end_p].replace("\n\s+", " ")
    except AttributeError:
        print("process_normal_field::error", field)
        raise Exception


def process_code_field(field, remove_backticks=False):
    if remove_backticks:
        field = re.sub(r"^```", "", field)
    return (
        "<pre>"
        + field.replace("<", "&lt;").replace(">", "&gt;").replace("\n", "___")
        + "</pre>"
    )


cards_done = 0
write_to = open(args.dest, "w", encoding="utf-8")
for card_data in yaml.load(open(args.src), Loader=yaml.FullLoader):
    new_card = new_card_template.copy()

    if 0 == len(card_data["question"]):
        continue

    if 1 <= len(card_data["question"]):
        new_card[0] = process_normal_field(card_data["question"][0])
    if 2 <= len(card_data["question"]):
        field = card_data["question"][1]
        if field[0:3] == "```":
            new_card[1] = process_code_field(field=field, remove_backticks=True)
        else:
            new_card[1] = process_normal_field(field)


    for i in range(0, FIELDS_ANSWERS):
        if i < len(card_data["answers"]):
            j = i + FIELDS_QUESTION
            field = str(card_data["answers"][i])
            if args.debug:
                print(field)
            if field[0:3] == "```":
                new_card[j] = process_code_field(field)
            else:
                new_card[j] = process_normal_field(field)

    if "config" in card_data:
        # I often get this wrong in the data
        if type(card_data["config"]) == list:
            card_data["config"] = card_data["config"].pop(0)
        for offset, config_key in enumerate(CONFIG_FIELDS):
            if config_key in card_data["config"]:
                config_value = card_data["config"][config_key]
                config_value = "x" if config_value else ""
                new_card[-(2 + offset)] = config_value

    if "tags" in card_data:
        new_card[-1] += " " + " ".join(card_data["tags"])

    write_card_to_file(new_card, write_to)
    cards_done += 1

write_to.close()

with open(args.dest, encoding="utf-8") as txt:
    exported_file = txt.read()
    print("\033[?7l")
    print(re.sub(r"\t", "➡️", exported_file))
    print("\033[?7h")

print("Done {} cards".format(cards_done))
exit(0)
