//this is where user send the message and memory checks for it 
// The actual chat logic. 
// Takes a user message → 
// builds the prompt with memories → 
// sends to LLM → 
// streams the response back word-by-word → 
// saves everything to the database

const {getOrCreateConversation, sendMessage, saveMessage, getMessages, updateTitle} = require(".manager");
const {getSystemPrompt} = require('./prompts');
const {chat: llmChat, stream: llmStream } = require('../llm/router');

const MOOD_KEYWORDS = {
    joyful:     ['happy', 'joy', 'amazing', 'wonderful', 'love', 'awesome', 'great', 'best', '😊', '😄', '🎉'],
    excited:    ['excited', 'can\'t wait', 'hyped', 'pumped', 'stoked', 'omg', '🔥', '🚀'],
    calm:       ['peaceful', 'calm', 'relaxed', 'chill', 'serene', 'content'],
    anxious:    ['anxious', 'worried', 'nervous', 'scared', 'stress', 'panic', 'overwhelm'],
    sad:        ['sad', 'depressed', 'lonely', 'miss', 'crying', 'heartbroken', 'empty', '😢'],
    frustrated: ['frustrated', 'annoyed', 'ugh', 'stuck', 'hate', 'tired of', 'sick of'],
    angry:      ['angry', 'furious', 'rage', 'pissed', 'mad', 'wtf'],
};

function detectMood(message){
    const lower = message.toLowerCase();
    for(const[mood, keywords] of Object.entries(MOOD_KEYWORDS)){
        if(keywords.some(keyword=> lower.includes(keyword))) return mood;
    }
    return 'neutral';
}