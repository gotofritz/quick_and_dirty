var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res) {
  res.json({
    _id: '5b9d65aa1922a57f045ff03e',
    title: 'xxxtitle',
    fillers: ['zwar', 'überhaupt', 'aber', 'eh', 'sowieso', 'ohnehin'],
    text:
      'Die Deutschen gelten [[als]] vorsichtiges Volk.Mehr als 2000 Euro gibt jeder Bundesbürger im Schnitt pro Jahr [[für]] Versicherungen aus.[[Doch]] Verbraucherschützer warnen: Viele Menschen versichern sich falsch.[[Häufig]] seien wichtige Risiken nicht abgedeckt, andere Aspekte dafür völlig überversichert.\n\nUm herauszufinden, was wirklich nötig ist, sollte man sich klarmachen, welcheRisiken im Einzelfallbestehen und ob man sie [[auch]] ohne Versicherung abdeckenkönnte.Auf den Rat von Versicherungsvertretern kann man sich dabei [[nur]] bedingt verlassen.Schließlich winkt [[dem]] Verkäufer für jeden Vertragsabschluss eineProvision.Er hat [[damit]] einen Anreiz, seinen Kunden lieber mehr als weniger Policen zu empfehlen.\n\nWichtig ist [[deshalb]] eine einfache Regel: Risiken, dieeinen finanziellen Totalschaden bedeuten, sollten abgesichert werden. Darunter fallen zum Beispiel Haftungsschäden, die an anderenPersonen oder fremdem Eigentum verursacht werden - [[also]] etwa die ausgelaufene Waschmaschine, die das gesamteMietshaus unter Wasser setzt, oder der verletzte Fußgänger, der vomFahrradfahrer[[auf]] die Straße gedrängtwurde. Hier ist die Schadenshöhe theoretisch unbegrenzt - eine Versicherung ist deshalb sehr sinnvoll.\n\nBei Risiken mit potentiell begrenzten Schäden dagegen - wie zum Beispiel am eigenen Auto [[und]] der eigenen Wohnung - sollte man sich überlegen, ob man die nötigeSumme im Schadensfall nichtauch selbstbezahlen könnte. [[Wenn]] das so ist, kann man sich die Versicherungsprämie oft sparen.\n\nEinen Überblick, welche Versicherungen für wen sinnvoll sind, finden Sie [[hier]]:',
  });
});

module.exports = router;
