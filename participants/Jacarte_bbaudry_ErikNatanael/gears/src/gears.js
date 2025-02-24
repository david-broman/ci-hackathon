const Tone = require("./libs/tone.js");
const StartAudioContext = require("./libs/StartAudioContext.js");


ws = new WebSocket('wss://travis.durieux.me');
//const maxNumberTracks = 25; //maximum number of tracks (CI jobs) that we listen to in parallel

/* I think there's a similar pen somewhere else, but I wasn't able to find it 

* UPDATE - Godje sent me his similar pen:
https://codepen.io/Godje/post/spinning-stars-mechanics
*/

let jobs = {

}

let l_sampler;
let r_sampler;
let l_swooshSampler;
let r_swooshSampler;
let droneSampler;

let audioInitiated = false;

StartAudioContext(Tone.context, 'start-stop').then(function(){
    //callback is invoked when the AudioContext.state is 'running'
    console.log("Starts audio context");
    audioInitiated = true;
})

function getRadius(message){

    const lang = message.data.config.language;

    switch (lang) {
        // script languages and platforms
        case 'php':
        case 'r':
        case 'python':
        case 'groovy':
        case 'perl':
        case 'perl6':
            return [0, 1];

        // systems
        case 'android':
        case 'c':
        case 'go':
        case 'nix':
        case 'rust':
        case 'bash':
            return [1, 2];

        // frontend/client
        case 'node_js':
        case 'dart':
        case 'elm':
        case 'swift':
        case 'js':
        case 'objective-c':
            return [2, 3];

        // backend 
        case 'haskell':
        case 'd':
        case 'crystal':
        case 'clojure':
        case 'elixir':
        case 'erlang':
        case 'ruby':
            return [3, 4];

        // Apps
        case 'scala':
        case 'c#':
        case 'haxe':
        case 'c++':
        case 'cpp':
        case 'smalltalk':
        case 'julia':
        case 'java':
            return [5, 7];
        

        case 'erlang':
                return [8, 9];
        
    }

    return undefined
}


function getColor(message){

    if(!message)
        return '#000000'

    const lang = message.data.config.language;

    switch (lang) {
        // script languages and platforms
        case 'php':
        case 'r':
        case 'python':
        case 'groovy':
        case 'perl':
        case 'perl6':
            return '#ffeede';

        // systems
        case 'android':
        case 'c':
        case 'go':
        case 'nix':
        case 'rust':
        case 'bash':
            return '#fdb94d';

        // frontend/client
        case 'node_js':
        case 'dart':
        case 'elm':
        case 'swift':
        case 'js':
        case 'objective-c':
            return '#ee303a';

        // backend 
        case 'haskell':
        case 'd':
        case 'crystal':
        case 'clojure':
        case 'elixir':
        case 'erlang':
        case 'ruby':
            return '#471b34';

        // Apps
        case 'scala':
        case 'c#':
        case 'haxe':
        case 'c++':
        case 'cpp':
        case 'smalltalk':
        case 'julia':
        case 'java':
            return '#97d7df';
        

        case 'erlang':
                return '#ee303a';
        
    }

    return undefined;
}


function handleJob(message){

    //console.log(message)

    if (message.data.state === "started") {
                
        let ring = assignRing(message)

        if(ring){   
            ring.id = message.data.commit.id
            jobs[ring.id] = message
            jobs[ring.id].ring = ring

            let sound = soundForJob(message) // get the pitch associated with the language of the job
            
            if(audioInitiated) {
              if(ring.center[0] < w/2) {
                // left
                l_sampler.triggerAttack(sound);
              } else {
                // right
                r_sampler.triggerAttack(sound);
              }
              
            }
        }
         
    }
    else {
        if ((message.data.commit.id in jobs)) {

            if(message.data.state === "finished" || message.data.state === "errored" || message.data.state === "failed" || message.data.state === "passed"){
                
                let key = message.data.commit.id
                
                mergeRing(key, message)            

            // const fmSynth = new Tone.FMSynth(
            //   {
            //     harmonicity : 2 ,
            //     modulationIndex : 8 ,
            //     detune : 0.05 ,
            //     oscillator : {
            //       type : "sine"
            //     },
            //     envelope : {
            //       attack : 0.5 ,
            //       decay : 0.01 ,
            //       sustain : 1 ,
            //       release : 3
            //     },
            //     modulation : {
            //       type : "square"
            //     },
            //     modulationEnvelope : {
            //       attack : 0.5 ,
            //       decay : 0 ,
            //       sustain : 1 ,
            //       release : 0.5
            //     }
            //   }
            // ).toMaster()

            let state = message.data.state

            console.log("PLaying?")
            let pitch = "A1";
            switch(state){
                case "passed":
                    //color = '#42f5ce55'; // green
                    pitch = "G1";
                    break;
                case "errored":
                    //color = '#0088ff55'; // blue
                    pitch = "F1";
                    break;
                case "finished":
                    //color = '#ffbf0055'; // yellow
                    pitch = "B1";
                    break;
                case "failed":
                    //color = 'ff000055'; // gray
                    pitch = "G#1";
                    break;
            }
            pitch = Tone.Frequency(Math.random() * 30 + 31, "midi")
            if(audioInitiated) {
              
              let ring = getRing(key);
              if(ring != undefined) {
                if(ring.center[0] < w/2) {
                  // left
                  l_swooshSampler.triggerAttack(pitch);
                } else {
                  // right
                  r_swooshSampler.triggerAttack(pitch);
                }
              }
              
            }        
            }
            //delete jobs[message.data.commit.sha]
        }
    }
}


ws.onmessage = function (event) {
    const message = JSON.parse(event.data);
    handleJob(message)
}

function mergeRing(commitId, message){

    let ring = getRing(commitId)

    if(ring){
        let size = ring.chunks.length - 1

        if(size <= 0){

            jobs[commitId].ring.id = undefined
            delete  jobs[commitId]
        }
        else{
            splitRing(message, ring, ring.chunks.length - 1)
        }
    }

}

function splitRing(message, ring, size){

    let theta = Math.PI*2/size;

    ring.chunks = []

    let last = 0
    for(let i = 0; i < size; i++){
        ring.chunks.push([last, last + theta - 0.2])
        last += theta;
    }

    return ring
}

function getRing(id){
    for(let ring of rings)
        if(ring.id === id)
            return ring
    return undefined
}

function assignRing(message){

    for(let ring of rings)
        if(ring.id === message.data.commit.id)
            return splitRing(message, ring, ring.chunks.length + 1)

    //let radiusRange = getRadius(message)
    
    //if(radiusRange){
    //    let scale = radius.length/6

    //    let min, max
    //    min = scale * radiusRange[0] * width
    //    max = scale*radiusRange[1] * width


        for(let ring of rings){
            if(!ring.id)// && ring.innerRadius >= min && ring.innerRadius <= max)
                return ring
        }
    //}

    return undefined
}


let ctx, r;
let w = 1200, h = 1200;
const TAU = 2*Math.PI, MAX_R = 1500;

const colors = ["#ff000080", "#00ff0080", "#0000ff80", "#00ffff80"]
let width = 10

function getRandom(min, max){
    return min + Math.random()*(max - min)
}

function getRandomInt(min, max){
    return parseInt(Math.random() *(max- min )+ min)
}

function createRings(x, y, width, count, setRadius, which){


    for(let i = 1; i <= count; i++){
        // for each ring

        let innerRadius = i*width;

        if(setRadius)
            radius.push(innerRadius)

        rings.push({
            color: "#000000",
            innerRadius,
            center: [x, y],
            chunks: [[0, Math.PI*2]],
            id: undefined,
            position: which, // Left or right side
            direction: i %2 == 0? -speed/i: speed/i,
            outerRadius: width + innerRadius
        })
        
        
    }

}

function setup(){

	r, canvas = document.createElement('canvas');
  w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
	canvas.width = w;
	canvas.height = h;
	document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    
    let numRings = 50;
    let ringWidth = w/((numRings+1)*4);
    
    createRings(w/4, h/2, ringWidth, numRings, true, "left")
    createRings(3*w/4, h/2, ringWidth, numRings, false, "right")

    requestAnimationFrame(draw);
    
    let l_panner = new Tone.Panner(-1);
    let r_panner = new Tone.Panner(1);
    
    // Setup sound
    l_sampler = new Tone.Sampler({
    	"G1" : "samples/bellg1-1.mp3",
    	"D2" : "samples/belld2-1.mp3",
    	"B3" : "samples/bellb3-1.mp3",
      "D4" : "samples/belld4-1.mp3",
      "G4" : "samples/bellg4-1.mp3",
      "E2" : "samples/belle2-1.mp3",
    }, {
      "release" : 12,
    }).chain(l_panner, Tone.Master);
    l_sampler.volume.value = -24;
    r_sampler = new Tone.Sampler({
    	"G1" : "samples/bellg1-1.mp3",
    	"D2" : "samples/belld2-1.mp3",
    	"B3" : "samples/bellb3-1.mp3",
      "D4" : "samples/belld4-1.mp3",
      "G4" : "samples/bellg4-1.mp3",
      "E2" : "samples/belle2-1.mp3",
    }, {
      "release" : 12,
    }).chain(r_panner, Tone.Master);
    r_sampler.volume.value = -24;
    
    l_swooshSampler = new Tone.Sampler({
    	"G1" : "swoosh1-1.mp3",
    	"F1" : "swoosh2-1.mp3",
    	"B1" : "swoosh3-1.mp3",
      "G#1" : "swoosh4-1.mp3",
    }, {
      baseUrl : "samples/",
      "release" : 1,
    }).chain(l_panner, Tone.Master);
    l_swooshSampler.volume.value = -24;
    r_swooshSampler = new Tone.Sampler({
    	"G1" : "swoosh1-1.mp3",
    	"F1" : "swoosh2-1.mp3",
    	"B1" : "swoosh3-1.mp3",
      "G#1" : "swoosh4-1.mp3",
    }, {
      baseUrl : "samples/",
      "release" : 1,
    }).chain(r_panner, Tone.Master);
    r_swooshSampler.volume.value = -24;
    
    droneSampler = new Tone.Sampler({
    	"C1" : "drone.mp3",
    }, {
      baseUrl : "samples/",
      release : 200,
      onload : () => {
        droneSampler.triggerAttack("C1");
      }
    }).toMaster();
    droneSampler.volume.value = -16;
}

let speed = 4
let globalTime  = 0
let step = 0.005
let space = -0.1

let rings = [

]
let radius = []

// To paint it
function createRing(x, y, innerRadius, outerRadius, fromTheta, toTheta, color){
  
  let arcStart = fromTheta;
  let arcMaxLength = toTheta - fromTheta;
  let arcLength = 0.02;
  let arcPosition = (Math.random() * arcMaxLength) + arcStart;
  

    ctx.beginPath();
    //ctx.arc(x, y, innerRadius, fromTheta, toTheta);
    ctx.arc(x, y, innerRadius, arcPosition, arcPosition + arcLength);
    ctx.strokeStyle = color;
    ctx.lineWidth = outerRadius - innerRadius - space;
    ctx.stroke();

    //2 * Math.PI
}


function soundForJob(message) {
    const lang = message.data.config.language;

    switch (lang) {
        // script languages and platforms
        case 'php':
        case 'r':
        case 'python':
        case 'groovy':
        case 'perl':
        case 'perl6':
            return 'B3';

        // systems
        case 'android':
        case 'c':
        case 'go':
        case 'nix':
        case 'rust':
        case 'bash':
            return 'G1';

        // frontend/client
        case 'node_js':
        case 'dart':
        case 'elm':
        case 'swift':
        case 'js':
        case 'objective-c':
            return 'G4';

        // backend 
        case 'haskell':
        case 'd':
        case 'crystal':
        case 'clojure':
        case 'elixir':
        case 'erlang':
        case 'ruby':
            return 'D2';

        // Apps
        case 'scala':
        case 'c#':
        case 'haxe':
        case 'c++':
        case 'cpp':
        case 'smalltalk':
        case 'julia':
        case 'java':
            return 'D4';
        

        case 'erlang':
                return 'E2';
        
    }

    console.log("Not analyzed " + lang)
    return undefined;
}


function createSynth(position){

    

    let which = null;

    if(position === 'left'){
        which = new Tone.Panner(-1);
    }
    else{
        which = new Tone.Panner(1);
    }

    
    
    let synth =  new Tone.Synth({
        oscillator: {
            type: 'triangle8'
        },
        envelope: {
            attack: 2,
            decay: 1,
            sustain: 0.4,
            release: 4
        }
    }).toMaster();


    synth.chain(which, Tone.Master)

    return synth;
}

function draw(){
    
    globalTime += step

    //ctx.clearRect(0,0, w, h)
    //ctx.globalAlpha = 0.009;
    ctx.globalAlpha = Math.abs((Math.sin(globalTime * 0.1) * 0.01) + 0.011);
    //console.log("alpha: " + Math.abs((Math.sin(globalTime * 0.1) * 0.01) + 0.011));
    ctx.fillRect(0,0,w,h);
    ctx.globalAlpha = 1.0;
    for(var ring of rings){
        for(var chunk of ring.chunks){
          for(let i = 0; i < 3; i++) {
            createRing(ring.center[0], ring.center[1], ring.innerRadius, 
                
                ring.outerRadius, chunk[0] + ring.direction*globalTime, 
                chunk[1] + globalTime*ring.direction, 
                ring.id === undefined? '#00000088': getColor(jobs[ring.id]))
          }
        }
    }

    requestAnimationFrame(draw);
    
    // 60 
}

window.onload = setup;