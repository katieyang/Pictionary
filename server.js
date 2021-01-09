//importing the express module
var express = require("express");
var app = express();
var server = app.listen(process.env.PORT || 5000);
app.use(express.static("public"));

console.log("server is running");

var socket = require("socket.io");
var io = socket(server); //keep track of inputs and outputs to the server

const timePerTurn = 60;
const numRounds = 2;

var game = "";
//dictionary containing players for each connection
var players = {}; //key is socketid, value is the player obj (so far just tracks username and score)
var roomLeader = "";
var roomLeaderQueue = []; //first one is roomLeader
var wordsList = ["rabbit","sponge","earmuffs","snowflake","rat","octopus","machine","gear","barn","bridge","money","clown","boardgame","salt","apple","medicine","shirt","fan","keyboard","instrument","light","knight","night","mouse","lamp","ice","heart","orange","banana","boat","tree","flamingo","bird","cat","owl","pie","queen","umbrella","castle","hero","playground","jump","wizard","computer","doll","egg"]

setInterval(function(){
	if(game != ""){
		io.sockets.emit("timer", game.timeLeft);
		if(game.timeLeft != 0){
			game.timeLeft--;
		} else {
			game.endTurn();
		}
	}
},1000);

io.sockets.on("connection", newConnection);

function newConnection(socket) {
	console.log("new connection: " + socket.id);
	io.to(socket.id).emit("showModal",1);

	socket.on("disconnect", () => {	
		console.log("lost connection: " + socket.id);
		if(Object.keys(players).indexOf(socket.id) != -1) {
			io.sockets.emit("chat message", new ChatMessage("", players[socket.id].username + " has exited the room. ","system"));
			delete(players[socket.id]);
			
			//end the game if player was in game
			if(game != ""){
				if(Object.keys(game.players).indexOf(socket.id) != -1){
					game.endGame();
					return;
				}
			}

			//update roomLeaderQeue
			roomLeaderQueue = roomLeaderQueue.filter(item => item !== socket.id);

			if(roomLeader == socket.id){
				//need a new roomLeader
				if(roomLeaderQueue.length == 0){
					roomLeader = "";
				} else {
					roomLeader = roomLeaderQueue[0];
					for(player in players){
						if(player != roomLeader){
							io.to(player).emit("chat message", new ChatMessage("", players[roomLeader].username + " is the room leader. ","system"));
						}
					}
					io.to(roomLeader).emit("chat message",new ChatMessage("", "You are the room leader. When there are at least 3+ players in the room and you wish to start the game, please type 'start' into the chat.","system"));
				}
			}
		}
  	});

	// everyone outside of the game should eventually be sent to another room!

	socket.on("username", updateusername);
	socket.on("chat message", chatMsg);
	socket.on("drawing coordinates", sendDrawing);
	socket.on("clear",sendClear)

	function updateusername(username){
		players[socket.id] = new Player(socket.id);
		roomLeaderQueue.push(socket.id);
		if(roomLeader == ""){
			roomLeader = socket.id;
		}
		if(username != ""){
			players[socket.id].username = username;
		}
		if(Object.keys(players).length == 1){
			io.sockets.emit("chat message", new ChatMessage("", players[socket.id].username + " has entered the game. There is 1 player in the room.","system"));
		} else {
			io.sockets.emit("chat message", new ChatMessage("", players[socket.id].username + " has entered the game. There are " + Object.keys(players).length + " players in the room.","system"));
		}
		if(roomLeader == socket.id){
			io.to(socket.id).emit("chat message",new ChatMessage("", "You are the room leader. When there are at least 3+ players in the room and you wish to start the game, please type 'start' into the chat.","system"))
		} else {
			if(game == ""){
				io.to(socket.id).emit("chat message",new ChatMessage("", "Please wait for the game to start.","system"));	
			}
		}
		if(game != ""){
			io.to(socket.id).emit("chat message",new ChatMessage("", "A game is currently underway, please wait for the next game.","system"));
		}
	}

	function chatMsg(chat){
		if(chat != ""){
			if(game != "" && game.cantChat.indexOf(socket.id) != -1){
				if(socket.id == game.drawer){
					io.to(socket.id).emit("chat message", new ChatMessage("", "As the drawer, you can't type in chat.", "system"));
				}
			} else {
				if(chat != game.chosenWord){
					io.sockets.emit("chat message", new ChatMessage(players[socket.id].username, chat, "player"));
				}
				if(chat == game.chosenWord && Object.keys(game.players).indexOf(socket.id) == -1){
					io.to(socket.id).emit("chat message", new ChatMessage("", "This is the correct guess, but you are not currently in the game. Please wait for the next game!", "system"));
				}
			}
		}

		if(chat == "start" && socket.id == roomLeader){
			if(Object.keys(players).length >= 3) {
				game = new Game(players);
				game.newTurn();
			} else {
				io.to(socket.id).emit("chat message", new ChatMessage("", "Not enough players.", "system"))
			}
		} 

		// Handling guesses when players are in game
		if (game != "" && Object.keys(game.players).indexOf(socket.id) != -1){
			if(chat.toLowerCase() == game.chosenWord){
				io.to(socket.id).emit("chat message", new ChatMessage("", "You guessed correctly!", "system"))
				//give the correct guesser points based on time left, drawer 5 points/correct guess
				game.players[socket.id].score += Math.ceil(game.timeLeft/timePerTurn * 15);
				game.players[game.drawer].score += 5;
				game.cantChat.push(socket.id);
				game.guessedCorrectly.push(socket.id);

				//check if everyone has guessed correctly, if so turn should end
				if(game.guessedCorrectly.length == Object.keys(game.players).length - 1){
					game.endTurn();
				}
			} else if (wordsAreClose(chat.toLowerCase(), game.chosenWord)){
				io.to(socket.id).emit("chat message", new ChatMessage("", "Your guess is close!", "system"))
			}
		}
	}

	function sendDrawing(mousePos){ //mousePos = [mouseX,mouseY,pmouseX,pmouseY]
		if(game != ""){
			if(game.drawer == socket.id){
				socket.broadcast.emit("drawing coordinates", mousePos);
			}
		}
	}

	function sendClear(){
		if(game != ""){
			if(game.drawer == socket.id){
				io.sockets.emit("clear", 1);
			}
		}
	}

}

function wordsAreClose(word1, word2){ //returns true if two words are close
  //plural
  if(word2.includes(word1)){
    return true;
  }
  //if there are most letters in common
  var lettersInCommon = 0;
  for(var i = 0; i < word1.length; i++){
    if(word1.charAt(i) == word2.charAt(i)){
      lettersInCommon++;
    }
    if(lettersInCommon >= word1.length -1){
      return true;
    }
  }
  return false;
}

//All the objects

function ChatMessage(username, message, messageType){	//messageType can be "system" or "player"
	this.username = username;
	this.message = message;
	this.messageType = messageType;
}

function Game(players){
	this.players = JSON.parse(JSON.stringify(players)); //contains scores
	this.currentRound = 1;
	this.alreadyDrawn = []; //who hasn't drawn yet this round
	this.drawer = "" //pick randomly from someone who hasn"t drawn yet
	this.chosenWord = "";
	this.wordsAlreadyChosen = [];
	this.cantChat = []; //contains of people who can't chat
	this.guessedCorrectly = []; //those who have guessed correctly this round
	this.timeLeft = 0;
	this.winner = "";

	this.newTurn = function(){
		this.cantChat = [];
		this.guessedCorrectly = [];
		this.timeLeft = timePerTurn;
		// Clear the canvas
		io.sockets.emit("clear", 1);
		// Assign random player as drawer and make it so they can't chat
		while(true){
			var randPlayer = Object.keys(this.players)[Math.floor(Math.random()*Object.keys(this.players).length)];
			if(this.alreadyDrawn.indexOf(randPlayer) == -1){
				this.alreadyDrawn.push(randPlayer);
				this.drawer = randPlayer;
				this.cantChat.push(randPlayer);
				break;
			}
		}
		// Announce what round and turn it is
		io.sockets.emit("chat message",new ChatMessage("","Round " + this.currentRound + "Turn " + this.alreadyDrawn.length, "system"));
		this.newWord();
	}

	this.newWord = function(){
		//Generates random word for drawing/guessing this turn
		while(true){
			var word = wordsList[Math.floor(Math.random()*wordsList.length)];
			if(this.wordsAlreadyChosen.indexOf(word) == -1){
				this.wordsAlreadyChosen.push(word);
				this.chosenWord = word;
				break;
			}
		}
		io.to(this.drawer).emit("chat message",new ChatMessage("","You are the drawer. The word you are drawing is: " + this.chosenWord, "system"));
		//Send message to everyone except drawer
		for(player in this.players){
			if(player != this.drawer){
				io.to(player).emit("chat message",new ChatMessage("","Please wait for the drawer to draw and then type your guess.","system"));
			}
		}
	}

	this.endGame = function(){
		//determine winner
		var maxScore;
		for(player in this.players){
			if(this.winner == "" || this.players[player].score > maxScore){
				this.winner = this.players[player].username;
				maxScore = this.players[player].score;
			}
		}
		//send winner over
		io.sockets.emit("clear", 1);
		io.sockets.emit("winner", this.winner);
		io.sockets.emit("victory", 1);
		//end the game
		game = "";
		for (player in players){
			if(player != roomLeader){
				io.to(player).emit("chat message", new ChatMessage("", players[roomLeader].username + " is the room leader. Please wait for them to start the next round.","system"));
			}
		}
		io.to(roomLeader).emit("chat message",new ChatMessage("", "You are the room leader. When there are at least 3+ players in the room and you wish to start the game, please type 'start' into the chat.","system"))
		return;
	}

	this.endTurn = function(){
		//Emit that the turn is over and the scores
		io.sockets.emit("chat message",new ChatMessage("", "Round " + this.currentRound + " Turn " + this.alreadyDrawn.length + " is over. The current scores are:", "system"));
		for(player in this.players){
			io.sockets.emit("chat message",new ChatMessage("", this.players[player].username +": " + this.players[player].score, "score"));
		}
		// check if the round is over
		if(Object.keys(this.players).length == this.alreadyDrawn.length){
			//if it's the last round, end the game
			if(this.currentRound == numRounds){
				this.endGame();
				return;
			}
			//round is over
			this.currentRound++;
			this.alreadyDrawn = [];
			this.newTurn();
		} else {
			this.newTurn();
		}
	}
}

function Player(username){
	this.username = username;
	this.score = 0;
}

