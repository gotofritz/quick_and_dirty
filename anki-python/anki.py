#!/usr/bin/env python
import argparse
import markdown
import re

md = markdown.Markdown(output_format='html5')
md_start = len('<p>')
md_end = len('</p>')
SEPARATOR = 2
DEFAULT_TAGS = 'geeky '

parser = argparse.ArgumentParser(description='Creates importable anki files')
parser.add_argument('--fields', dest='fields', required=True, type=int,
                    help='How many total fields the card expects')
parser.add_argument('--src', dest='src', required=True,
                    help='Text file to scan')
parser.add_argument('--dest', dest='dest', default='anki.txt',
                    help='Text file to write to')
parser.add_argument('--tags', dest='tags', default='',
                    help='Tags to add to defaut (default: geeky')
args = parser.parse_args()

def write_card_to_file(the_card, the_file):
  # don't write empty cards
  should_write = any(bool(field) for field in the_card[:-1])
  if should_write:
    the_file.write("\t".join(the_card) + "\n")


cards = []
newlines = 0
trigger_new_card = SEPARATOR - 1
total_cards = 0
card_pointer = 0
new_card_template = [''] * args.fields
new_card_template.append(DEFAULT_TAGS + args.tags)
new_card = new_card_template.copy()

write_to = open(args.dest, 'w', encoding='utf-8')
with  open(args.src) as read_from:
  for line in read_from:
    if (line == '\n'):
      if (newlines >= trigger_new_card):
        total_cards += 1
        card_pointer = 0
        write_card_to_file(new_card, write_to)
        new_card = new_card_template.copy()
      else:
        card_pointer += 1
      newlines += 1
    else:
      line = line.strip()
      if not re.match('<pre>', line):
        # sadly markdown wraps everything in <p>...</p>
        # we take the substring inside those
        line = md.convert(line)[md_start:-md_end]
      new_card[card_pointer] = line
      card_pointer += 1
      newlines = 0
write_card_to_file(new_card, write_to)
total_cards += 1

write_to.close()
print("Done, {} cards".format(total_cards))