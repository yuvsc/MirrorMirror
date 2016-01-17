//Top Left: Time
function updateTime() {
    $("#top-left > span#date").text(moment().format('dddd MMMM Do YYYY'));
    $("#top-left > span#time").text(moment().format('HH:mm:ss'));
}
updateTime();
setInterval(updateTime, 1000);

//Top Right: Weather
var skycons = new Skycons({"color": "white"});

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition);
    } else {
        x.innerHTML = "Geolocation is not supported by this browser.";
    }
}
function showPosition(position) {
    //x.innerHTML = "Latitude: " + position.coords.latitude + 
    //"<br>Longitude: " + position.coords.longitude;
    console.log(position);
    var location = position;
    var url = 'https://api.forecast.io/forecast/';
    $.getJSON(url + FORCAST_API_KEY + "/" + location.coords.latitude + "," + location.coords.longitude + "?callback=?", function(data) {
        console.log(data);
        $("#weather-today > span#todayTemp").html(data.currently.temperature + "&deg; F");
        skycons.add("todayIcon", data.currently.icon);

        for (var i = 0; i < data.daily.data.length; i++) {
            data.daily.data[i].day = moment.unix(data.daily.data[i].time).format('ddd');
            $("#weather-week > span#day"+i).text(data.daily.data[i].day);
            $("#weather-week > span#high"+i).text(data.daily.data[i].temperatureMax.toFixed(2));
            $("#weather-week > span#low"+i).text(data.daily.data[i].temperatureMin.toFixed(2));
            skycons.add("icon"+i, data.daily.data[i].icon);
        };
        
        $("#weather-description > span#weatherText").text(data.daily.summary);
    });
    skycons.play();
}

function updateWeather() {
    getLocation();
}
    
updateWeather();
setInterval(updateWeather, 1000 * 3600);

//Bottom Right: Mood
function updateMood() {
    $.getJSON("https://api.thingspeak.com/channels/"+thingspeak.channel+"/feed/last.json?api_key="+thingspeak.api_key+"&callback=?",
              function(data) {
                console.log(data);
                $("#mood > #mood-text").text(data.field1);
                $("#mood > #mood-date").text(new moment(data.created_at).format('dddd MMMM Do YYYY'));
                })
}

function setMood(mood) {
    var form = new FormData();
    form.append("api_key", thingspeak.api_key);
    form.append("field1", mood);

    var settings = {
      "async": true,
      "crossDomain": true,
      "url": "http://api.thingspeak.com/update",
      "method": "POST",
      "processData": false,
      "contentType": false,
      "mimeType": "multipart/form-data",
      "data": form
    }

    $.ajax(settings).done(function (response) {
      console.log(response);
      setTimeout(updateMood(), 5000);
    });
}
updateMood();
setInterval(updateMood, 1000 * 3600);

function setGreeting(greeting) {
    $("#greeting").text(greeting);
    setTimeout(clearGreeting, 7000);
}

function clearGreeting() {
    $("#greeting").text("");
}

if (annyang) {
    // Add our commands to annyang
    annyang.addCommands({
        'go to sleep': function() { console.debug("go to sleep"); $("#sleep-cover").addClass("sleep-cover")},
        'wake up': function() { console.debug("wake up"); $("#sleep-cover").removeClass("sleep-cover")},

        'take a photo': function() { console.debug("take a photo"); document.getElementsByClassName("trigger")[0].click(); },
        'take a selfie': function() { console.debug("take a photo"); document.getElementsByClassName("trigger")[0].click(); },
        'clear photo': function() {console.debug("clearing photo"); document.getElementById("selfie").src = "";},
        'show photo controls': function() { console.debug("Showing photo controls"); container = document.getElementById( "example" ); container.style.display = "";},                      
        'hide photo controls': function() { console.debug("Hiding photo controls"); container = document.getElementById( "example" ); container.style.display = "none";},
        
        'my mood (today) is *mood': function(mood) {setMood(mood)},
        'I am feeling *mood': function(mood) {setMood(mood)},
        'good night': function() { console.debug("go to sleep"); setGreeting("Good Night!"); $("#sleep-cover").addClass("sleep-cover")},
        'good morning': function() { console.debug("wake up"); $("#sleep-cover").removeClass("sleep-cover"); setGreeting("Good Morning!");},
        'hello': function() { console.debug("wake up"); $("#sleep-cover").removeClass("sleep-cover"); setGreeting("Hello!");},
    });

    // Tell KITT to use annyang
    SpeechKITT.annyang();

    // Define a stylesheet for KITT to use
    SpeechKITT.setStylesheet('css/flat.css');
    // Render KITT's interface
    SpeechKITT.vroom();

    SpeechKITT.toggleRecognition();

    commands = ['go to sleep', 'wake up', 'take a photo', 'clear photo', 'show photo controls', 'hide photo controls', 'my mood (today) is <mood>', 'I am feeling *mood', 'take a selfie', 'good morning', 'good night', 'hello']
    function showRandomCommand() {
        var rand = commands[Math.floor(Math.random() * commands.length)];
        SpeechKITT.setSampleCommands([rand]);
    }
    SpeechKITT.setInstructionsText("Try saying...")
    showRandomCommand();
    setInterval(showRandomCommand, 5000);
    
    annyang.addCallback('resultMatch', function (userSaid, commandText, phrases) {
         setTimeout(function() { $("#speech").text(" ") }, 4000);
        //console.log(userSaid); // sample output: 'hello'
        //console.log(commandText); // sample output: 'hello (there)'
        //console.log(phrases); // sample output: ['hello', 'halo', 'yellow', 'polo', 'hello kitty']
    });
    
    annyang.addCallback('resultNoMatch', function (userSaid, commandText, phrases) {
         setTimeout(function() { $("#speech").text(" ") }, 4000);
        //console.log(userSaid); // sample output: 'hello'
        //console.log(commandText); // sample output: 'hello (there)'
        //console.log(phrases); // sample output: ['hello', 'halo', 'yellow', 'polo', 'hello kitty']
    });
    
    annyang.addCallback('interimResult', function (userSaid, commandText, phrases) {
        console.log(userSaid); // sample output: 'hello'
        //console.log(commandText); // sample output: 'hello (there)'
        $("#speech").text(userSaid);
        //console.log(phrases); // sample output: ['hello', 'halo', 'yellow', 'polo', 'hello kitty']
    });
    
    annyang.debug([newState=true]);
}


container = document.getElementById( "example" );
gallery = document.getElementById( "gallery" );

myPhotobooth = new Photobooth( container );
container.style.display = "none";
var shutter = new Audio();
shutter.autoplay = false;
shutter.src = navigator.userAgent.match(/Firefox/) ? 'webcam/shutter.ogg' : 'webcam/shutter.mp3';

myPhotobooth.onImage = function( dataUrl ){
    shutter.play();
    var myImage = document.getElementById( "selfie" );
    myImage.src = dataUrl;
};