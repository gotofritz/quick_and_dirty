#!/usr/bin/env python
import argparse
import markdown
import re
import yaml

yaml.reader.Reader.NON_PRINTABLE = re.compile(
    u'[^\x09\x0A\x0D\x20-\x7E\x85\xA0-\uD7FF\uE000-\uFFFD\U00010000-\U0010FFFF]')
parser = argparse.ArgumentParser(description='Creates importable anki files')
parser.add_argument('--fields', dest='fields', default=15, type=int,
                    help='How many total fields the card expects')
parser.add_argument('--src', dest='src', required=True,
                    help='Text file to scan')
parser.add_argument('--dest', dest='dest', default='anki.txt',
                    help='Text file to write to')
parser.add_argument('--tags', dest='tags', default='',
                    help='Tags to add to defaut (default: geeky)')
parser.add_argument('--debug', dest='debug', action='store_true',
                    help='boolean')
args = parser.parse_args()

DEFAULT_TAGS = 'geeky '
FIELDS_QUESTION = 2
FIELDS_ANSWERS = 12
new_card_template = [''] * args.fields
new_card_template.append(DEFAULT_TAGS)
md = markdown.Markdown(output_format='html5')
md_start_p = len('<p>')
md_end_p = len('</p>')

def write_card_to_file(the_card, the_file):
  the_file.write("\t".join(the_card) + "\n")

def process_normal_field(field):
  # sadly markdown wraps everything in <p>...</p>
  # we take the substring inside those.
  # additionally VSC wraps in stupid newlines, so we get rid of those
  return md.convert(field)[md_start_p:-md_end_p].replace("\n\s+", " ")

def process_code_field(field):
  return "<pre>" + field.replace("<", "&lt;").replace(">", "&gt;").replace("\n", "___") + "</pre>"

cards_done = 0
write_to = open(args.dest, 'w', encoding='utf-8')
for card_data in yaml.load(open(args.src), Loader=yaml.FullLoader):
  new_card = new_card_template.copy()

  if 0 == len(card_data['question']):
    continue

  if 1 <= len(card_data['question']):
    new_card[0] = process_normal_field(card_data['question'][0])
  if 2 <= len(card_data['question']):
    new_card[1] = process_code_field(card_data['question'][1])

  for i in range(0, FIELDS_ANSWERS):
    if i < len(card_data['answers']):
      j = i + FIELDS_QUESTION
      field = card_data['answers'][i]
      if args.debug:
        print(field)
      if field[0:3] == '```':
        new_card[j] = process_code_field(field)
      else:
        new_card[j] = process_normal_field(field)

  if 'config' in card_data and 'noNumber' in card_data['config'] and card_data['config']['noNumber']:
    new_card[-2] = 'x'

  if 'tags' in card_data:
    new_card[-1] += ' ' + ' '.join(card_data['tags'])
  else:
    new_card[-1] += ' ' + args.tags

  write_card_to_file(new_card, write_to)
  cards_done += 1

write_to.close()

print("Done {} cards".format(cards_done))
exit(0)
