// Chat — a small Slack-like chat room across a few fixed channels, talking
// straight to boxlang-express's raw app.ws() (routes/Chat.bx) over one
// WebSocket connection. No REST calls at all: joining, switching channels,
// and sending messages are all frames on the same socket. See routes/Chat.bx
// for the full protocol.
const CHANNELS = [ "general", "random", "dev" ];
const NAME_KEY = "chat.name";
const RECONNECT_DELAY_MS = 2000;

// Suggested name for the "pick a display name" gate — a generated
// verb+noun gamertag in the spirit of Dungeon Crawler Carl's crawler
// handles. Generated rather than picked from a fixed list so two people
// showing up at once don't land on the same suggestion: 32 verbs x 36 nouns
// is ~1150 combinations, plenty for a small shared demo. Just a prefilled,
// editable suggestion either way — nothing stops anyone from typing over it.
const NAME_VERBS = [
	"Bumbling", "Cursed", "Screaming", "Farting", "Wobbling", "Deranged",
	"Feral", "Suspicious", "Flaming", "Sneaky", "Drunken", "Rabid",
	"Confused", "Panicking", "Glitching", "Exploding", "Unlucky", "Soggy",
	"Wheezing", "Snoring", "Gassy", "Squishy", "Stinky", "Wobbly",
	"Grumpy", "Sleepy", "Chonky", "Spicy", "Naked", "Screeching",
	"Haunted", "Radioactive"
];
const NAME_NOUNS = [
	"Goblin", "Slime", "Wizard", "Skeleton", "Mimic", "Boss", "Duck",
	"Potato", "Toaster", "Narrator", "Sponsor", "Crawler", "Cultist",
	"Mailman", "Gremlin", "Kobold", "Chicken", "Hamster", "Zombie",
	"Vampire", "Dragon", "Peasant", "Bard", "Rogue", "Cleric", "Rat",
	"Owlbear", "Beholder", "Lich", "Ghoul", "Wraith", "Ogre", "Troll",
	"Fairy", "Pixie", "Sprite"
];

function randomSuggestedName() {
	const verb = NAME_VERBS[ Math.floor( Math.random() * NAME_VERBS.length ) ];
	const noun = NAME_NOUNS[ Math.floor( Math.random() * NAME_NOUNS.length ) ];
	return `${ verb } ${ noun }`;
}

let socket = null;
let currentChannel = "general";
let myName = "";
let reconnectTimer = null;

const nameGate = document.getElementById( "nameGate" );
const nameInput = document.getElementById( "nameInput" );
const nameSubmit = document.getElementById( "nameSubmit" );
const changeNameBtn = document.getElementById( "changeName" );
const meNameEl = document.getElementById( "meName" );
const statusEl = document.getElementById( "status" );
const channelListEl = document.getElementById( "channelList" );
const channelTitleEl = document.getElementById( "channelTitle" );
const rosterEl = document.getElementById( "roster" );
const messagesEl = document.getElementById( "messages" );
const composer = document.getElementById( "composer" );
const composerInput = document.getElementById( "composerInput" );

function buildChannelList() {
	channelListEl.innerHTML = "";
	CHANNELS.forEach( ( name ) => {
		const btn = document.createElement( "button" );
		btn.type = "button";
		btn.className = "ch-channel-btn" + ( name === currentChannel ? " is-active" : "" );
		btn.textContent = "#" + name;
		btn.addEventListener( "click", () => switchChannel( name ) );
		channelListEl.appendChild( btn );
	} );
}

function addLine( className, html ) {
	const line = document.createElement( "div" );
	line.className = "ch-msg " + className;
	line.innerHTML = html;
	messagesEl.appendChild( line );
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml( text ) {
	const div = document.createElement( "div" );
	div.textContent = text;
	return div.innerHTML;
}

function addMessage( from, text ) {
	addLine( "", `<span class="ch-msg-from">${ escapeHtml( from ) }</span><span class="ch-msg-text">${ escapeHtml( text ) }</span>` );
}

function addSystem( text ) {
	addLine( "is-system", escapeHtml( text ) );
}

function addError( text ) {
	addLine( "is-error", escapeHtml( text ) );
}

function setStatus( text, state ) {
	statusEl.textContent = text;
	statusEl.dataset.state = state;
}

function renderRoster( members ) {
	rosterEl.textContent = members.length
		? members.length + " here: " + members.join( ", " )
		: "just you";
}

function sendFrame( data ) {
	if ( socket && socket.readyState === WebSocket.OPEN ) {
		socket.send( JSON.stringify( data ) );
	}
}

function switchChannel( name ) {
	if ( name === currentChannel && messagesEl.children.length ) return;
	currentChannel = name;
	channelTitleEl.textContent = "#" + name;
	composerInput.placeholder = "Message #" + name;
	buildChannelList();
	messagesEl.innerHTML = "";
	sendFrame( { type: "join", channel: name, name: myName } );
}

function connect() {
	const proto = location.protocol === "https:" ? "wss:" : "ws:";
	socket = new WebSocket( proto + "//" + location.host + "/games/chat/socket" );

	socket.addEventListener( "open", () => {
		setStatus( "live", "live" );
		sendFrame( { type: "join", channel: currentChannel, name: myName } );
	} );

	socket.addEventListener( "message", ( ev ) => {
		let data;
		try {
			data = JSON.parse( ev.data );
		} catch ( err ) {
			return;
		}
		handleFrame( data );
	} );

	socket.addEventListener( "close", () => {
		setStatus( "reconnecting…", "error" );
		reconnectTimer = setTimeout( connect, RECONNECT_DELAY_MS );
	} );

	socket.addEventListener( "error", () => {
		socket.close();
	} );
}

function handleFrame( data ) {
	if ( data.channel && data.channel !== currentChannel ) return;

	switch ( data.type ) {
		case "joined":
			messagesEl.innerHTML = "";
			data.history.forEach( ( m ) => addMessage( m.from, m.text ) );
			renderRoster( data.roster );
			break;
		case "message":
			addMessage( data.from, data.text );
			break;
		case "system":
			addSystem( data.text );
			break;
		case "roster":
			renderRoster( data.members );
			break;
		case "error":
			addError( data.message );
			break;
	}
}

composer.addEventListener( "submit", ( ev ) => {
	ev.preventDefault();
	const text = composerInput.value.trim();
	if ( !text ) return;
	sendFrame( { type: "message", text } );
	composerInput.value = "";
} );

function startChat( name ) {
	myName = name;
	localStorage.setItem( NAME_KEY, name );
	meNameEl.textContent = name;
	nameGate.classList.add( "is-hidden" );
	if ( !socket ) {
		connect();
	} else {
		sendFrame( { type: "join", channel: currentChannel, name: myName } );
	}
}

nameSubmit.addEventListener( "click", () => {
	const name = nameInput.value.trim();
	if ( !name ) {
		nameInput.focus();
		return;
	}
	startChat( name );
} );

nameInput.addEventListener( "keydown", ( ev ) => {
	if ( ev.key === "Enter" ) nameSubmit.click();
} );

changeNameBtn.addEventListener( "click", () => {
	nameInput.value = myName;
	nameGate.classList.remove( "is-hidden" );
	nameInput.focus();
} );

buildChannelList();

const savedName = localStorage.getItem( NAME_KEY );
if ( savedName ) {
	nameInput.value = savedName;
	startChat( savedName );
} else {
	nameInput.value = randomSuggestedName();
	nameInput.select();
}
