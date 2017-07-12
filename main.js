const fetch = require('node-fetch'),
	csv = require("fast-csv"),
	fs = require("fs"),
	download = require('image-downloader')
	config = require('./config.json');

const TOKEN = config.token;
const INSTANCE =config.instance;
const CSV_FILE = "exports/export.csv";
const DRAFT_CSV_FILE = "exports/export_drafts.csv";
const SPEAKERS_CSV_FILE = "exports/export_speakers.csv";
const VALIDATE_SPEAKERS_CSV_FILE = "exports/export_validate_speakers.csv";
const BACKUP_SPEAKERS_CSV_FILE = "exports/export_backup_speakers.csv";
const REJECT_SPEAKERS_CSV_FILE = "exports/export_reject_speakers.csv";
const STATS_CSV_FILE = "exports/export_stats.csv";
const SCHEDULE_JSON = "exports/schedule.json";
const SPEAKERS_JSON = "exports/speakers.json";
const SESSIONS_JSON = "exports/sessions.json";


const URL_DRAFTS = "https://api.cfp.io/v0/admin/drafts";
const URL_SESSIONS = "https://api.cfp.io/v0/admin/sessions";
const URL_FORMATS = "https://api.cfp.io/v0/formats";
const URL_TRACKS = "https://api.cfp.io/v0/tracks";
const URL_SPEAKERS = "https://api.cfp.io/v0/tracks/speakers";
const URL_SCHEDULE_SPEAKERS = "https://api.cfp.io/api/schedule/speakers";
const URL_SCHEDULE = "https://api.cfp.io/api/schedule";
const Headers = {
		'Pragma': 'no-cache',
		'Origin': `https://${INSTANCE}.cfp.io`,
		'Accept-Encoding': 'gzip, deflate, sdch, br',
		'Accept-Language': 'fr-FR,en-US;q=0.8,fr;q=0.6,en;q=0.4',
		//'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
		//'Accept': 'application/json, text/plain, */*',
		'Referer': `https://${INSTANCE}.cfp.io/`,
		'Cookie': `gsScrollPos=; token=${TOKEN}`,
		'Connection': 'keep-alive',
		'Cache-Control': 'no-cache'
	};
const options = {
	method: 'GET',
	headers: Headers
};

let formatsMap = {},
	tracksMap = {};

fetch(URL_FORMATS, options)
.then((res) => res.json())
.then((json) => {
	json.forEach((format) => {
		formatsMap[format.id] = format;
	});
	return fetch(URL_TRACKS, options);
})
.then((res) => res.json())
.then((json) => {
	json.forEach((track) => {
		tracksMap[track.id] = track;
	});

	// extractValidateSpeakers();
	//extractBackupSpeakers();
	//extractRejects();

	extractJsons();

})

function extractJsons(){

	const arrayPromise = [];
	arrayPromise.push(new Promise((resolve)=>{ fetch(URL_SCHEDULE_SPEAKERS, options)
		.then(res => res.json())
		.then(json => resolve(json));
	}));
	arrayPromise.push(new Promise((resolve)=>{
		fetch(URL_SCHEDULE, options)
		.then(res => res.json())
		.then(json => resolve(json));
	}));
	arrayPromise.push(new Promise((resolve)=>{
		fetch(URL_SESSIONS, options)
		.then(res => res.json())
		.then(json => resolve(json));
	}));

	Promise.all(arrayPromise)
	.then((sessionsSpeakersSchedule)=>{
		const speakers = sessionsSpeakersSchedule[0];
		let schedule = sessionsSpeakersSchedule[1];
		const sessions = sessionsSpeakersSchedule[2];


		const scheduleJson = [];
		const speakerJson = {};
		const sessionsJson = {};

		schedule = schedule.sort((session1, session2) => {
			return new Date(session1.event_start).getTime() - new Date(session2.event_start).getTime();
		});

		const sessionMap = {};
		sessions.forEach((session) => {
			sessionMap[session.id] = session;
		});

		const speakerMaps = {};
		speakers.forEach((speaker) => {
			if (speaker.firstname){
				const socials = [];
				if (speaker.twitter && speaker.twitter.length > 0) {
					socials.push({
						icon: 'twitter',
						name: 'Twitter',
						link: speaker.twitter.indexOf('/') != -1 ? speaker.twitter : speaker.twitter.indexOf('@') != -1 ? `https://twitter.com/${speaker.twitter.substring(1, speaker.twitter.length - 1)}` : `https://twitter.com/${speaker.twitter}`
					});
				}
				if (speaker.googleplus && speaker.googleplus.length > 0){
					socials.push({
						icon: 'gplus',
						name: 'Google+',
						link: speaker.googleplus.indexOf('/') != -1 ? speaker.googleplus : speaker.googleplus.indexOf('+') != -1 ? `https://google.com/${speaker.googleplus}` : `https://google.com/+${speaker.googleplus}`
					});
				}
				if (speaker.github && speaker.github.length > 0){
					socials.push({
						icon: 'github',
						name: 'Github',
						link: speaker.github.indexOf('/') != -1 ? speaker.github : `https://github.com/${speaker.github}`
					});
				}
				if (speaker.social && speaker.social.length > 0){
					let socials = speaker.social.split(',');
					socials.forEach((social) => {
						socials.push({
							icon: 'website',
							name: 'Website',
							link: social
						});
					});
				}


				let fileName = '';
				if (speaker.imageProfilURL){
					const file_name_array = speaker.imageProfilURL.split(".");
					let file_extension = file_name_array[file_name_array.length - 1];
					if (file_extension.toLowerCase() != 'jpg'
					&& file_extension.toLowerCase() != 'jpeg'
					&& file_extension.toLowerCase() != 'png'){
						file_extension = 'jpg';
					}
					fileName = `images/speakers/${speaker.firstname}_${speaker.lastname}.${file_extension}`;
					if (!fs.existsSync(fileName)) {
						download.image({
							url: speaker.imageProfilURL,
							dest: fileName
						})
						.then(({ filename, image }) => {})
						.catch((err) => {
							console.log(`Erreur pendant la sauvegarde de l'image poru ${speaker.firstname} ${speaker.lastname} : ${speaker.imageProfilURL}`);
							console.log(err);
						});
					}
				}else{
					console.log(`${speaker.firstname} ${speaker.lastname} n'a pas de photo`);
				}

				speakerJson[`${speaker.id}`] = {
					id : speaker.id,
					name : `${speaker.firstname} ${speaker.lastname}`,
					company : speaker.company,
					country: '',
					photoUrl: fileName,
					shortBio: speaker.bio.substring(0, speaker.bio.indexOf('.')),
					bio: speaker.bio,
					tags: '',
					badges: [],
					socials: socials

				}
				speakerMaps[`${speaker.firstname} ${speaker.lastname}`] = speaker;
			}
		});

		const dayMaps = {};

		schedule.forEach((session) => {
			const daySession = new Date(session.event_start);
			const dayString = daySession.toISOString().substring(0,10);
			const eventStartString = daySession.toISOString().substring(11,16);
			const eventEndString = new Date(session.event_end).toISOString().substring(11,16);
			let day = dayMaps[dayString];
			if (!day){
				day = {
					date : dayString,
					dateReadable : daySession.toLocaleDateString('en-US', {month:'long', day:"2-digit"}),
					tracks : [
						{title: "Titan"},
						{title: "Belem"},
						{title: "Tour Bretagne"},
						{title: "Graslin"},
						{title: "Les machines"}
					],
					timeslots: []
				};
				dayMaps[dayString] = day;
			}

			let timeslot = null;
			day.timeslots.forEach((timeslotTmp) => {
				if (timeslotTmp.startTime === eventStartString && timeslotTmp.endTime === eventEndString){
					timeslot = timeslotTmp;
				}
			});
			if (!timeslot){
				timeslot = {
					startTime : eventStartString,
					endTime: eventEndString,
					sessions: []
				}
				day.timeslots.push(timeslot);
			}
			timeslot.sessions.push([session.id]);


			const speakersArray = [];
			const speakersSplit = session.speakers.split(',');
			speakersSplit.forEach((speakerName) => {
				const speaker = speakerMaps[speakerName.trim()];
				if (speaker){
					speakersArray.push(speaker.id);
				}else if(speakerName.trim().length > 0){
					console.log(`Problème de speaker avec la conf ${session.name} : ${session.speakers}`);
				}
			});

			const sessionTmp = sessionMap[session.id];

			const category = session.event_type === 'Web' ? 'web' : session.event_type === 'Discovery' ? 'discovery' : session.event_type === 'Mobile & IoT' ? 'mobile' : 'cloud';
			sessionsJson[`${session.id}`] = {
				id: session.id,
				title: session.name,
				description: session.description,
				type: session.format === 'Conference' ? 'talk' : session.format === 'Quickie' ? 'quicky' : 'codelab',
				track: {title: session.venue},
				category: category,
				language: sessionMap[session.id].language === 'Français' ? 'fr' : 'en',
				tags: [category, session.format],
				complexity : sessionTmp.difficulty === 1 ? 'Beginner' : sessionTmp.difficulty === 2 ? 'Intermediate' : 'Expert',
				speakers : speakersArray
			};
		});

		for(let day in dayMaps){
			scheduleJson.push(dayMaps[day]);
		}

		addBreakSessions(scheduleJson, sessionsJson);
		fixSessions(sessionsJson, speakerJson);

		fs.writeFile(SCHEDULE_JSON, JSON.stringify(scheduleJson, null, 4));
		fs.writeFile(SPEAKERS_JSON, JSON.stringify(speakerJson, null, 4));
		fs.writeFile(SESSIONS_JSON, JSON.stringify(sessionsJson, null, 4));
	});


}

function extractValidateSpeakers(){
	const arrayPromise = [];
	arrayPromise.push(new Promise((resolve)=>{ fetch(URL_SCHEDULE_SPEAKERS, options)
		.then(res => res.json())
		.then(json => resolve(json));
	}));
	arrayPromise.push(new Promise((resolve)=>{
		fetch(URL_SCHEDULE, options)
		.then(res => res.json())
		.then(json => resolve(json));
	}));

	Promise.all(arrayPromise)
	.then((sessionsSpeakersSchedule)=>{
		const speakers = sessionsSpeakersSchedule[0];
		const schedule = sessionsSpeakersSchedule[1];

		/*const sessionMap = {};
		const speakersMap = {};
		const scheduleMap = {};
		sessions.forEach((session) =>{
			sessionMap[session.id] = session;
		});
		*/
		const finalArray = [];

		schedule.forEach((session)=>{
			const speakersForSession = [];
			speakers.forEach((speaker)=>{
				if (session.speakers.indexOf(`${speaker.firstname} ${speaker.lastname}`) != -1){
					speakersForSession.push(speaker);
					finalArray.push({
						firstname: speaker.firstname,
						lastname: speaker.lastname,
						name: `${speaker.firstname} ${speaker.lastname}`,
						email : speaker.email,
						format : session.format,
						session : session.name
					})
				}
			});
		});

		writeValidateSpeakers(finalArray);

	});
}

function extractBackupSpeakers(){
	fetch(URL_SESSIONS, options)
	.then((res) => res.json())
	.then((sessions) => {

		const promiseArray = [];
		const sessionsBackup = sessions.filter((session => session.state === 'BACKUP'));
		sessionsBackup.forEach((session) =>{
			promiseArray.push(new Promise((resolve)=>{
				fetch(`${URL_SESSIONS}/${session.id}`,{
					method: 'GET',
					headers: Headers
				})
				.then((resTemp) => resTemp.json())
				.then((resJson) => resolve(resJson))
			}));
		});
		return Promise.all(promiseArray);

	})
	.then((sessionsBackup) =>{
		writeBackupSessions(sessionsBackup);
	});
}

function extractRejects(){
	fetch(URL_SESSIONS, options)
	.then((res) => res.json())
	.then((sessions) => {

		const promiseArray = [];
		const sessionsReject = sessions.filter((session => session.state === 'REFUSED'));
		sessionsReject.forEach((session) =>{
			promiseArray.push(new Promise((resolve)=>{
				fetch(`${URL_SESSIONS}/${session.id}`,{
					method: 'GET',
					headers: Headers
				})
				.then((resTemp) => resTemp.json())
				.then((resJson) => resolve(resJson))
			}));
		});
		return Promise.all(promiseArray);

	})
	.then((sessionsReject) =>{
		writeRefusedSessions(sessionsReject);
	});
}

function addBreakSessions(scheduleJson, sessionsJson){

	// Day 1 Gates Opens
	sessionsJson["0"] = {
		"id": 0,
		"title": "Ouverture des portes / Gates open",
		"titleMobile": "Gates open",
		"image": "/images/backgrounds/opening.jpg",
		"type": "break"
	}
	scheduleJson[0].timeslots.push(
		{
			"startTime": "08:00",
			"endTime": "09:00",
			"sessions": [[0]]
		});

	// Day 1 Keynote
	sessionsJson["1"] = {
		"id": 1,
		"title": "Keynote d'ouverture / Opening keynote",
		"titleMobile": "Opening keynote",
		"image": "/images/backgrounds/keynote.jpg",
		"type": "keynote"
	}
	scheduleJson[0].timeslots.push(
		{
			"startTime": "09:00",
			"endTime": "09:50",
			"sessions": [[1]]
		});

	// Day 1 Lunch
	sessionsJson["2"] = {
		"id": 2,
		"title": "Déjeuner / Lunch",
		"titleMobile": "Lunch",
		"description": "Foooooood !!!",
		"image": "/images/backgrounds/lunch.jpg",
		"type": "break"
	}
	scheduleJson[0].timeslots.push(
		{
			"startTime": "12:00",
			"endTime": "14:00",
			"sessions": [[2]]
		});

	// Day 1 After
	sessionsJson["3"] = {
		"id": 3,
		"title": "After Party",
		"description": "Cette année l’After Party est organisé par notre partenaires U GIE IRIS (Système U). <br />Elle aura lieu sur place à la Cité des Congrès (dans la Grande Galerie) à partir de 18h30 le Jeudi 19 Octobre. <br />Retrouvons-nous autour d'un apéro pour discuter des événements de la 1ère journée et faire du networking. A l'affiche, des démos, des découvertes, de la musique...<br />Venez nombreux !!",
		"image": "/images/backgrounds/party.jpg",
		"type": "break"
	}
	scheduleJson[0].timeslots.push(
		{
			"startTime": "18:30",
			"endTime": "23:00",
			"sessions": [[3]]
		});

	// Day 2 Gates Opens
	sessionsJson["4"] = {
		"id": 4,
		"title": "Ouverture des portes / Gates open",
		"titleMobile": "Gates open",
		"image": "/images/backgrounds/opening.jpg",
		"type": "break"
	}
	scheduleJson[1].timeslots.push(
		{
			"startTime": "08:30",
			"endTime": "09:00",
			"sessions": [[4]]
		});

	// Day 2 Lunch
	sessionsJson["5"] = {
		"id": 5,
		"title": "Déjeuner / Lunch",
		"titleMobile": "Lunch",
		"description": "Foooooood !!!",
		"image": "/images/backgrounds/lunch.jpg",
		"type": "break"
	}
	scheduleJson[1].timeslots.push(
		{
			"startTime": "12:10",
			"endTime": "14:00",
			"sessions": [[5]]
		});

	scheduleJson[0].timeslots = scheduleJson[0].timeslots.sort((slot1, slot2) => +slot1.startTime.substring(0,2) - +slot2.startTime.substring(0,2));
	scheduleJson[1].timeslots = scheduleJson[1].timeslots.sort((slot1, slot2) => +slot1.startTime.substring(0,2) - +slot2.startTime.substring(0,2));
}

function fixSessions(sessionsJson, speakerJson){

	// Yufeng Guo
	const confYufeng = sessionsJson["1910"];
	confYufeng.title = "TensorFlow Wide & Deep: Advanced Classification the easy way";
	confYufeng.description = "In this talk, we will go on an adventure to build a machine learning model that combines the benefits of linear regression models with deep neural networks. You will also gain some intuition about what is happening under the hood, and learn how you can use this model for your own datasets."
	confYufeng.speakers = [101];
	speakerJson["101"] = {
			id : 101,
			name : "Yufeng Guo",
			company : "Google",
			country: '',
			photoUrl: "Yufeng_Guo.webp",
			shortBio: "Yufeng is a Developer Advocate for the Google Cloud Platform",
			bio: "Yufeng is a Developer Advocate for the Google Cloud Platform, where he is trying to make machine learning more understandable and usable for all. He is enjoys hearing about new and interesting applications of machine learning, share your use case with him on Twitter @YufengG",
			tags: '',
			badges: [],
			socials: [{
				icon: 'twitter',
				name: 'Twitter',
				link: "https://twitter.com/YufengG"
			}]
	};

	// Patrick Chanezon
	const confPatrick = sessionsJson["1913"];
	confPatrick.title = "Docker for developers and ops: what's new and what's next";
	confPatrick.speakers = [102];
	speakerJson["102"] = {
			id : 102,
			name : "Patrick Chanezon",
			company : "Docker",
			country: '',
			photoUrl: "Patrick_Chanezon.jpg",
			shortBio: "Chief Developer Advocate, Docker Inc",
			bio: "Patrick Chanezon is Chief Developer Advocate at Docker Inc. He helps to build Docker, the world’s leading software container platform, for developers and sysadmins. Software developer and storyteller, he spent 10 years building platforms at Netscape & Sun, then 10 years evangelizing platforms at Google, VMware & Microsoft. His main professional interest is in building and kickstarting the network effect for these wondrous two-sided markets called Platforms. He has worked on platforms for Portals, Ads, Commerce, Social, Web, Distributed Apps, and Cloud. ",
			tags: '',
			badges: [],
			socials: [{
				icon: 'twitter',
				name: 'Twitter',
				link: "https://twitter.com/chanezon"
			}]
	};

	// Android Retrospective
	const confAndroid = sessionsJson["1926"];
	confAndroid.speakers.push(103);
	speakerJson["103"] = {
			id : 103,
			name : "Chet Haase",
			company : "Google",
			country: '',
			photoUrl: "Chet_Haase.jpg",
			shortBio: "Chet leads the Android UI Toolkit team at Google",
			bio: "Chet leads the Android UI Toolkit team at Google, where he works on animations, graphics, UI widgets, and anything else that puts pixels on the screen. He also writes and performs comedy if given the chance or a mic.",
			tags: '',
			badges: [],
			socials: [{
				icon: 'twitter',
				name: 'Twitter',
				link: "https://twitter.com/chethaase"
			},{
				icon: 'website',
				name: 'Website',
				link: "https://medium.com/@chethaase"
			}]
	};

	// SpeechLess
	const confSpeechLess = sessionsJson["1937"];
	confSpeechLess.title = "Keynote de fermeture";
	confSpeechLess.description = "Description à venir bientôt";
	confSpeechLess.speakers = [];

	// Suppr JF
	delete speakerJson["175"];

}

/*.then((res) => res.json())
.then((json) => {
	if (Array.isArray(json)){
		const promiseArray = [];
		json.forEach((session) =>{
			promiseArray.push(new Promise((resolve)=>{
				fetch(`${URL_SESSIONS}/${session.id}`,{
					method: 'GET',
					headers: Headers
				})
				.then((resTemp) => resTemp.json())
				.then((resJson) => resolve(resJson))
			}));
		});

		Promise.all(promiseArray)
		.then((resSessions) => {
			writeSpeakers(resSessions);
			writeStats(processStats(resSessions));
			writeSessions(resSessions.filter((session) => session.state === 'CONFIRMED'));
		})
	}
})*/
/*.then(() => {
	return fetch(URL_DRAFTS, options);
})
.then((res) => res.json())
.then((json) => {
	const promiseArray = [];
	json.forEach((draft) =>{
		promiseArray.push(new Promise((resolve)=>{
			fetch(`${URL_SESSIONS}/${draft.id}`,{
				method: 'GET',
				headers: Headers
			})
			.then((resTemp) => resTemp.json())
			.then((resJson) => resolve(resJson))
		}));
	});

	Promise.all(promiseArray)
	.then((resDrafts) => {
		writeDrafts(resDrafts);
	})
});*/



function writeValidateSpeakers(validateSPeakers){
	const csvStream = csv.createWriteStream({
		headers: true,
		delimiter: ";"
	});
    const writableStream = fs.createWriteStream(VALIDATE_SPEAKERS_CSV_FILE);

	writableStream.on("finish", function(){
	  console.log("DONE Speakers!");
	});

	csvStream.pipe(writableStream);
	validateSPeakers.forEach((validateSpeaker)=>{
		csvStream.write({
			speakerFirstname: validateSpeaker.firstname,
			speakerLastname: validateSpeaker.lastname,
			speakerName: validateSpeaker.name,
			sessionName: validateSpeaker.session,
			format: validateSpeaker.format,
			email: validateSpeaker.email
		});
	});
	csvStream.end();
}


function writeBackupSessions(sessions){
	const csvStream = csv.createWriteStream({
		headers: true,
		delimiter: ";"
	});
    const writableStream = fs.createWriteStream(BACKUP_SPEAKERS_CSV_FILE);

	writableStream.on("finish", function(){
	  console.log("DONE Backup!");
	});

	csvStream.pipe(writableStream);
	sessions.forEach((session)=>{
		csvStream.write({
			speakerFirstname: session.speaker.firstname,
			speakerLastname: session.speaker.lastname,
			speakerName: `${session.speaker.firstname} ${session.speaker.lastname}`,
			sessionName: session.name,
			format: formatsMap[session.format].name,
			email: session.speaker.email
		});
	});
	csvStream.end();
}

function writeRefusedSessions(sessions){
	const csvStream = csv.createWriteStream({
		headers: true,
		delimiter: ";"
	});
    const writableStream = fs.createWriteStream(REJECT_SPEAKERS_CSV_FILE);

	writableStream.on("finish", function(){
	  console.log("DONE Reject!");
	});

	csvStream.pipe(writableStream);
	sessions.forEach((session)=>{
		csvStream.write({
			sessionName: session.name,
			format: formatsMap[session.format].name,
			email: session.speaker.email
		});
		if (session.cospeakers && session.cospeakers.length > 0){
			session.cospeakers.forEach((cospeaker) => {
				csvStream.write({
					sessionName: session.name,
					format: formatsMap[session.format].name,
					email: cospeaker.email
				});
			});
		}
	});
	csvStream.end();
}

function writeDrafts(drafts){
	const csvStream = csv.createWriteStream({
		headers: true,
		delimiter: ";"
	});
    const writableStream = fs.createWriteStream(DRAFT_CSV_FILE);

	writableStream.on("finish", function(){
	  console.log("DONE Drafts!");
	});

	csvStream.pipe(writableStream);
	drafts.forEach((draft)=>{
		csvStream.write({
			speakerName: `${draft.speaker.firstname} ${draft.speaker.lastname}`,
			speakerEmail: draft.speaker.email,
			language: draft.language,
			draftType: formatsMap[draft.format].name,
			draftName: draft.name,
			draftTrack: tracksMap[draft.trackId].libelle,
			coSpeaker: draft.coSpeaker ? draft.coSpeakers.map((speaker) => `${speaker.firstname} ${speaker.lastname} (${speaker.email})`).join('') : ''
		});
	});
	csvStream.end();
}

function writeSessions(sessions){
	const csvStream = csv.createWriteStream({
		headers: true,
		delimiter: ";"
	});
    const writableStream = fs.createWriteStream(CSV_FILE);

	writableStream.on("finish", function(){
	  console.log("DONE Sessions Confirmed!");
	});

	csvStream.pipe(writableStream);
	sessions.forEach((session)=>{
		csvStream.write({
			speakerName: `${session.speaker.firstname} ${session.speaker.lastname}`,
			speakerCompany: session.speaker.company,
			speakerTwitter: session.speaker.twitter,
			speakerBio: session.speaker.bio,
			speakerEmail: session.speaker.email,
			speakerPhone: session.speaker.phone,
			sessionType: formatsMap[session.format].name,
			sessionName: session.name,
			sessionDesc: session.description,
			sessionDifficulty: session.difficulty === 1 ? 'Débutant' : (session.difficulty === 2 ? 'Confirmé' : 'Expert'),
			sessionTrack: tracksMap[session.trackId].libelle,
			coSpeaker: session.coSpeaker ? session.coSpeakers.map((speaker) => `${speaker.firstname} ${speaker.lastname} (${speaker.email})`).join('') : ''
		});
	});
	csvStream.end();
}

function writeStats(stats){
	const csvStream = csv.createWriteStream({
		headers: true,
		delimiter: ";"
	});
    const writableStream = fs.createWriteStream(STATS_CSV_FILE);

	writableStream.on("finish", function(){
	  console.log("DONE Stats!");
	});

	csvStream.pipe(writableStream);
	stats.repartitionDate.forEach((date)=>{
		csvStream.write({
			date: date.Date,
			NbTalks: date.NbTalks
		});
	});
	csvStream.end();
}

function writeSpeakers(sessions){

	const speakerMap = {};
	sessions.forEach(session => {
		if (!speakerMap[session.speaker.id]){
			speakerMap[session.speaker.id] = session.speaker;
		}
		if (session.coSpeaker){
			session.coSpeaker.forEach(coSpeaker =>{
				if (!speakerMap[coSpeaker.email]){
					speakerMap[coSpeaker.email] = coSpeaker;
				}
			});
		}
	})

	const csvStream = csv.createWriteStream({
		headers: true,
		delimiter: ";"
	});
    const writableStream = fs.createWriteStream(SPEAKERS_CSV_FILE);

	writableStream.on("finish", function(){
	  console.log("DONE Speakers!");
	});

	csvStream.pipe(writableStream);
	for (let speakerId in speakerMap){
		const speaker = speakerMap[speakerId];
		csvStream.write({
			Nom: `${speaker.firstname} ${speaker.lastname}`,
			Email: speaker.email
		});
	}

	csvStream.end();
}


function processStats(sessions){
	const webTrack = 'Web';
	const cloudTrack = 'Cloud, DevOps & BigData';
	const mobileTrack = 'Mobile & IoT';
	const discoveryTrack = 'Discovery';
	const dateMap = {};
	let tagCloudDesc = "";
	let tagCloudTitle = "";
	const langRepartition = {'Français' : 0, 'English' : 0};
	const codelabRepartition = {};
	codelabRepartition[webTrack] = 0;
	codelabRepartition[cloudTrack] = 0;
	codelabRepartition[mobileTrack] = 0;
	codelabRepartition[discoveryTrack] = 0;
	const conferencesRepartition = {};
	conferencesRepartition[webTrack] = 0;
	conferencesRepartition[cloudTrack] = 0;
	conferencesRepartition[mobileTrack] = 0;
	conferencesRepartition[discoveryTrack] = 0;
	const quickiesRepartition = {};
	quickiesRepartition[webTrack] = 0;
	quickiesRepartition[cloudTrack] = 0;
	quickiesRepartition[mobileTrack] = 0;
	quickiesRepartition[discoveryTrack] = 0;
	let count = 0;

	sessions.forEach(session => {
		count++;
		const dateAdd = new Date(session.added);
		dateAdd.setHours(0);
		dateAdd.setMinutes(0);
		dateAdd.setSeconds(0);
		dateAdd.setMilliseconds(0);

		if (!dateMap[dateAdd.getTime()]){
			dateMap[dateAdd.getTime()] = 0;
		}
		dateMap[dateAdd.getTime()]++;

		tagCloudDesc += session.description;
		tagCloudTitle += session.name;
		langRepartition[session.language]++;

		switch(session.format){
			case 92:
				conferencesRepartition[session.trackLabel]++;
				break;
			case 93:
				quickiesRepartition[session.trackLabel]++;
				break;
			case 94:
				codelabRepartition[session.trackLabel]++;
				break;
		}

	});

	const arrayDates = [];
	for(let dateTmp in dateMap){
		let formatDate = new Date(+dateTmp).toLocaleDateString('fr-FR', {day: '2-digit', year: 'numeric',month: '2-digit'});
		arrayDates.push({'Date' : formatDate, 'NbTalks' : dateMap[dateTmp]});
	}
	console.info(` Conférences --- ${conferencesRepartition[cloudTrack]+conferencesRepartition[webTrack]+conferencesRepartition[mobileTrack]+conferencesRepartition[discoveryTrack]}
		Cloud : ${conferencesRepartition[cloudTrack]}
		Web : ${conferencesRepartition[webTrack]}
		Mobile & IoT : ${conferencesRepartition[mobileTrack]}
		Discovery : ${conferencesRepartition[discoveryTrack]}
	 `);
	 console.info(` Quickies --- ${quickiesRepartition[cloudTrack]+quickiesRepartition[webTrack]+quickiesRepartition[mobileTrack]+quickiesRepartition[discoveryTrack]}
		Cloud : ${quickiesRepartition[cloudTrack]}
		Web : ${quickiesRepartition[webTrack]}
		Mobile & IoT : ${quickiesRepartition[mobileTrack]}
		Discovery : ${quickiesRepartition[discoveryTrack]}
	 `);
	 console.info(` CodeLabs --- ${codelabRepartition[cloudTrack]+codelabRepartition[webTrack]+codelabRepartition[mobileTrack]+codelabRepartition[discoveryTrack]}
		Cloud : ${codelabRepartition[cloudTrack]}
		Web : ${codelabRepartition[webTrack]}
		Mobile & IoT : ${codelabRepartition[mobileTrack]}
		Discovery : ${codelabRepartition[discoveryTrack]}
	 `);

	console.info(langRepartition);
	console.info(tagCloudTitle);

	return {
		tagCloud : tagCloudTitle,
		totalTalks : count,
		repartitionDate : arrayDates,
		conferencesRepartition : conferencesRepartition,
		quickiesRepartition : quickiesRepartition,
		codelabRepartition : quickiesRepartition,
		langRepartition : langRepartition
	};

}