import newspaper
import re
import nltk
import sacremoses
import pymongo
import random
import datetime
# nltk.download('punkt')

MAX_WORDS = 28
SO_MANY_FILLERS = 5
REASONABLE_SENTENCE_COUNT = 8

stop_words = [w.strip() for w in open('fetch-articles/config/stopwords-de.txt')]

urls = [
		'http://www.spiegel.de/',
		'http://www.taz.de/',
		'https://www.berliner-zeitung.de/',
		'https://www.stern.de/',
		'https://www.peterkroener.de/weblog/',
		'https://sports.vice.com/de',
		'https://www.vice.com/de',
		'https://de.wikihow.com/',
		'https://mein-deutschbuch.de/',
		'https://www.kicker.de',
		'http://yourdailygerman.wordpress.com/',
		'https://www.sr.de/sr/home/nachrichten/nachrichten_einfach/nachrichten_einfach100.html',
		'https://www.zeit.de/index',
		'http://www.faz.de/',
		'http://www.sueddeutsche.de/',
		'http://www.nzz.ch/',
		'https://www.bild.de/',
		'https://krautreporter.de/mitglied_werden',
		'https://watson.ch/',
		'http://www.heise.de/',
		'http://www.golem.de/',
		'https://netzpolitik.org/',
		# 'https://www.gulli.com/',
		'http://bastiansick.de/',
		'http://www.der-postillon.com/',
		'http://augengeradeaus.net/',
		'https://justillon.de/',
		'https://www.motor-talk.de/forum.html'
	]

db_client = pymongo.MongoClient('mongodb://localhost:27017')
db = db_client['german-missing-words']

for url in urls:
	site = newspaper.build(
			url,
			memoize_articles = False,
			language = 'de'
		)

	for source in site.articles:
		source.download()
		try:
			source.parse()
		except:
			continue
		text = source.text

		raw_blocks = re.split(r'(\n+)', text)
		usable_blocks = []
		for block in raw_blocks:
			# is a block short enough to be used as it is?
			words = nltk.word_tokenize(block)
			if len(words) <= MAX_WORDS:
				usable_blocks.append(block)
				continue
			# if we break the block into sentences, can they all be used?
			sentences_in_block = nltk.sent_tokenize(block)
			if all(len(nltk.word_tokenize(sentence)) <= MAX_WORDS for sentence in sentences_in_block):
				usable_blocks += sentences_in_block
				continue
			# otherwise we have to break them up randomly
			sentences_in_block = [
					' '.join(words[x:x+MAX_WORDS])
					for x in range(0, len(words), MAX_WORDS)
				]
			usable_blocks += sentences_in_block

		detokenizer = sacremoses.MosesDetokenizer()
		final_blocks = []
		next_stop = stop_words.copy()
		for sentence in usable_blocks:
			if re.match("\n+", sentence):
				final_blocks.append(sentence)
				continue
			sentence_in_words = nltk.word_tokenize(sentence)
			lc_sentence_in_words = [word.casefold() for word in sentence_in_words]
			for i in range(len(next_stop)):
				stop_word = next_stop[i]
				for j,v in enumerate(lc_sentence_in_words):
					if v == stop_word:
						sentence_in_words[j] = '[[' + sentence_in_words[j] + ']]'
						del next_stop[i]
						break
				else:
					continue
				break
			final_blocks.append(detokenizer.detokenize(sentence_in_words, return_str=True))

		reasonable_length_blocks = [
				' '.join(final_blocks[x:x+REASONABLE_SENTENCE_COUNT])
				for x in range(0, len(final_blocks), REASONABLE_SENTENCE_COUNT)
			]

		for p, processed in enumerate(reasonable_length_blocks):
			fillers = random.choices(
					next_stop,
					weights = [i for i in range(len(next_stop), 0, -1)],
					k = SO_MANY_FILLERS
				)

			db_articles = db.articles
			article_data = {
				'section': p + 1,
				'timestamp': datetime.datetime.now().isoformat(),
				'url': source.url,
				'title': source.title,
				'original': text,
				'text': processed,
				'fillers': fillers
			}
			result = db_articles.insert_one(article_data)
			print(article_data)

db.close()
exit()




# MAX_LOOP = 30
# current_loop = 0
# for article in site.articles:
# 	print(article.url)
# 	if current_loop > MAX_LOOP:
# 		break
# 	else:
# 		current_loop += 1

print("DONE", site.size())