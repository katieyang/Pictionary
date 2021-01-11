var socket;
var userNameSubmitted = false;
var mousePos = "";
var victorySFX;
var is_drawer = false;

function setup() {
  let canvas = createCanvas(600, 600);
  canvas.parent("sketch-holder");
  background(220);
  victorySFX = loadSound('victory.mp3');
  socket = io(); //defaults to host that serves the page
  
  socket.on("showModal",showModal);
  socket.on("victory",playVictory);
  socket.on("drawer",modDrawer);

  //Button panel
  clearButton = createButton("Clear");
  clearButton.position(550, 0);
  clearButton.mousePressed(() => {socket.emit("clear",1);});

// jQuery start
  $(document).ready(function() {
    //username modal start     
    $("#myModal").appendTo("body").modal("show");
    $("#myModal").on("hidden.bs.modal",function(){
      if(!userNameSubmitted){
        socket.emit("username","");
      }
    });
    $("#theButton").click(function() {
      socket.emit("username",$("#userName").val());
      userNameSubmitted = true;
    });
    //username modal end

    //focus on the textbox
    $("#myModal").on("shown.bs.modal", function(){
        $(this).find("#userName").focus();
    });

    //when you press enter, closes the modal
    $(document).keypress(function(e) {
      var keycode = (event.keyCode ? event.keyCode : event.which);
      if(keycode == "13"){
        if($("#myModal").is(":visible")){
          socket.emit("username",$("#userName").val());
          userNameSubmitted = true;
          $("#myModal").removeClass("in");
          $(".modal-backdrop").remove();
          $("#myModal").hide();
        }  
      }
    });

    //chatbox functionality start
    $("form").submit(function(e) {
      e.preventDefault(); // prevents page reloading
      socket.emit("chat message", $("#m").val());
      $("#m").val("");
    });

    socket.on("chat message", function(msg){
      console.log(msg);
      if(msg.messageType == "player"){
        $("#messages").append("<li><b>"+ msg.username +": </b>" + msg.message + "</li>");
      } else if(msg.messageType == "score") {
        $("#messages").append("<li class='scoreMsg'><b>" + msg.message + "</b></li>");
      } else {
        $("#messages").append("<li class='systemMsg'><b>" + msg.message + "</b></li>");
      }
    });
    //chatbox functionality end
  });
// jQuery end
}

function draw() { //pass what is being drawn over -> if game is happening and this person is the drawer, then pass drawing back to all clients
  socket.on("drawing coordinates", updateMousePos);
  socket.on("clear", clearIt);
  socket.on("timer", drawTime);
  socket.on("winner", drawWinner);
  socket.on("round_turn", drawRoundTurn);
}

function mouseDragged(){
  if (mouseButton === LEFT && !(mouseX < 40 && mouseY < 40) && is_drawer) {
    stroke("black");
    strokeWeight(5);
    line(mouseX,mouseY,pmouseX,pmouseY);
    socket.emit("drawing coordinates",[mouseX,mouseY,pmouseX,pmouseY]);
  }
}

function clearIt(){ //need to pass this along as well to server!
  clear();
  background(220);
}

function drawRoundTurn(round_turn){
  fill("black");
  textSize(24);
  textAlign(CENTER, TOP);
  text("Round " + round_turn[0] + " Turn " + round_turn[1], 300, 20);
  textSize(24);
  text("Drawer: " + round_turn[2], 300, 50);
}

function drawTime(time){
  strokeWeight(0);
  rectMode(CORNER);
  fill("white");
  rect(0,0,40,40);
  fill(0, 102, 153);
  textSize(32);
  textAlign(CENTER, CENTER);
  text(str(time), 20, 20);
}

function drawWinner(winner){
  rectMode(CENTER);
  fill("black");
  rect(300,300,600,300);
  fill("white")
  textSize(32);
  textAlign(CENTER, CENTER);
  text("Winner", 300, 200);
  textSize(24);
  text(winner, 300, 300);
}

function modDrawer(isDrawer){
  is_drawer = isDrawer;
}

function playVictory(){
  victorySFX.play();
}

function showModal(){
    $("#myModal").appendTo("body").modal("show");
}

function updateMousePos(pos){
  mousePos = pos;
  stroke("black");
  strokeWeight(5);
  line(mousePos[0], mousePos[1], mousePos[2], mousePos[3]);
}

