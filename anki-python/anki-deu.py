#!/usr/bin/env python
import argparse
import re
import csv
import random

# /Users/fritz/Downloads/1000GermanNouns.csv

parser = argparse.ArgumentParser(description='Creates importable anki files')
parser.add_argument('--src', dest='src', required=True,
                    help='Text file to scan')
parser.add_argument('--dest', dest='dest', default='anki.txt',
                    help='Text file to write to')
parser.add_argument('--tags', dest='tags', default='',
                    help='Tags to add to defaut (default: geeky')
args = parser.parse_args()

DEFAULT_TAGS = 'deu.noun '
new_card_template = [''] * 5
new_card_template.append(DEFAULT_TAGS + args.tags)

def write_card_to_file(the_card, the_file):
  the_file.write("\t".join(the_card) + "\n")

def last_vowel_to_umlauts(str):
    replacements = { 'a': 'ä', 'o': 'ö', 'u': 'ü', 'A': 'Ä', 'O': 'Ö', 'U': 'Ü'}
    vowels = dict.keys(replacements)
    str_len = len(str)
    for idx, item in enumerate(str[::-1], 1):
        if item in vowels:
            return str[:(str_len - idx)] + replacements[item] + str[str_len - idx + 1:]
    raise ValueError('no vowels found {}'.format(str))

cards_to_write = []
with open('/Users/fritz/Downloads/1000GermanNouns.csv', newline='') as File:
    reader = csv.reader(
        File,
        delimiter=','
    )
    for row in reader:
        new_card = new_card_template.copy()
        new_card[0] = row[2]
        new_card[1] = row[0]
        german = row[1].split(", ")
        singular, plural = german[0], german[1]
        if (plural == '-'):
            plural = singular
        elif (plural == 'x' or plural == '-x' or plural == 'X'):
            plural = '-'
        elif (plural == '(pl)'):
            plural, singular = singular, '-'
        elif (plural == '-en' and singular[-1] == 'a'):
            plural = singular[:-1] + plural[1:]
        elif (plural[1] == '¨'):
            plural = last_vowel_to_umlauts(singular) + plural[2:]
        elif (plural[0] == '-' and len(plural) > 1):
            plural = singular + plural[1:]
        new_card[2] = singular
        new_card[3] = plural
        # print(new_card)
        # print(']['.join(row))
        cards_to_write.append(new_card)

random.shuffle(cards_to_write)
cards_done = 0
with open(args.dest, 'w', encoding='utf-8') as write_to:
    for new_card in cards_to_write:
        write_card_to_file(new_card, write_to)
        cards_done += 1
write_to.close()

print("Done {} cards".format(cards_done))
exit(0)

cards_done = 0
write_to = open(args.dest, 'w', encoding='utf-8')
for card_data in yaml.load(open(args.src)):
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
      if field[0:3] == '```':
        new_card[j] = process_code_field(field)
      else:
        new_card[j] = process_normal_field(field)

  if 'config' in card_data and 'noNumber' in card_data['config'] and card_data['config']['noNumber']:
    new_card[-2] = 'x'

  if 'tags' in card_data:
    new_card[-1] += ' ' + ' '.join(card_data['tags'])

  write_card_to_file(new_card, write_to)
  cards_done += 1

write_to.close()

print("Done {} cards".format(cards_done))
exit(0)
