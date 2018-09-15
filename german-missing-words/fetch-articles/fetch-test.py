import newspaper
import re
import nltk
import sacremoses
# nltk.download('punkt')

MAX_WORDS = 28
MAX_LOOP = 30
current_loop = 0

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

text = """Die Deutschen gelten als vorsichtiges Volk. Mehr als 2000 Euro gibt jeder Bundesbürger im Schnitt pro Jahr für Versicherungen aus. Doch Verbraucherschützer warnen: Viele Menschen versichern sich falsch. Häufig seien wichtige Risiken nicht abgedeckt, andere Aspekte dafür völlig überversichert.

Um herauszufinden, was wirklich nötig ist, sollte man sich klarmachen, welche Risiken im Einzelfallbestehen und ob man sie auch ohne Versicherung abdecken könnte. Auf den Rat von Versicherungsvertretern kann man sich dabei nur bedingt verlassen. Schließlich winkt dem Verkäufer für jeden Vertragsabschluss eine Provision. Er hat damit einen Anreiz, seinen Kunden lieber mehr als weniger Policen zu empfehlen.

Wichtig ist deshalb eine einfache Regel: Risiken, die einen finanziellen Totalschaden bedeuten, sollten abgesichert werden. Darunter fallen zum Beispiel Haftungsschäden, die an anderen Personen oder fremdem Eigentum verursacht werden - also etwa die ausgelaufene Waschmaschine, die das gesamte Mietshaus unter Wasser setzt, oder der verletzte Fußgänger, der vom Fahrradfahrer auf die Straße gedrängtwurde. Hier ist die Schadenshöhe theoretisch unbegrenzt - eine Versicherung ist deshalb sehr sinnvoll.

Bei Risiken mit potentiell begrenzten Schäden dagegen - wie zum Beispiel am eigenen Auto und der eigenen Wohnung - sollte man sich überlegen, ob man die nötige Summe im Schadensfall nicht auch selbstbezahlen könnte. Wenn das so ist, kann man sich die Versicherungsprämie oft sparen.

Einen Überblick, welche Versicherungen für wen sinnvoll sind, finden Sie hier:"""

# site = newspaper.build(
# 		urls[0],
# 		memoize_articles = False,
# 		language = 'de'
# 	)

# article = site.articles[0]
# article.download()
# article.parse()
# text = article.text

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


print(''.join(final_blocks))
exit()




# for article in site.articles:
# 	print(article.url)
# 	if current_loop > MAX_LOOP:
# 		break
# 	else:
# 		current_loop += 1

print("DONE", site.size())