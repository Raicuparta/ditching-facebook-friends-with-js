# Ditching unfunny friends with Facebook data and React

Friendships are hard to maintain. So much energy is wasted maintaining friendships that might not actually provide any tangible returns. I find myself thinking "Sure I've known her since kindergarten, she introduced me to my wife, and let me crash at her place for 6 months when I was evicted, but is this *really* a worthwhile friendship?".

That's why I've decided to get rid of at least half of my friends, and just keep the useful ones going forward.

But how do I decide which friends to keep and which to ditch? What's the criteria? Looks? Intelligence? Money?

After a long debate with myself I reached a conclusion: sense of humor. I like funny stuff, so I should keep the funniest friends and get rid of everyone who bums me out. Plus, laughter is the best medicine, so there will be some health benefits.

The next question is how do I measure funny? Surely, sense of humor is subjective. There's no way to benchmark it empirically, right? **WRONG**. There is one surefire way to way to gauge sense of humor: *the amount of laughing emoji reactions received on Facebook Messenger.*

![And the bartender said "why the long face" lmao. 12 laughing emoji reactions.](https://i.imgur.com/ztbplsK.png)

Obviously counting manually is out of the question; I need to automate this task.

# Getting the data

Scraping the chats would be too slow. I think there's an API, but it looks scary and I'm not sure if it would allow me to do this. But there is one way to get all the info I need at once.

![Facebook data download page](https://i.imgur.com/nl0GO6g.png)

Facebook lets me download all the deeply personal information they collected on me over the years in an easily readable JSON format. So kind of them! I make sure to select only the data I need (messages), and select the lowest image quality, to keep the archive as small as possible. It can take hours or even days to generate.

The next day, I get an email notifying me that the archive is ready to download (all 8.6 GB of it) under the "Available Copies" tab. The zip file has the following structure:

```
messages
├── archived_threads
│   └── [chats]
├── filtered_threads
│   └── [chats]
├── inbox
│   └── [chats]
├── message_requests
│   └── [chats]
└── stickers_used
    └── [bunch of PNGs]
```

The directory I am interested in is `inbox`. That's where all the active chats are. The directories I marked with `[chats]` have more sub-directories inside them, one for each chat. The name of each of these is generated from the chat name, plus a unique identifier. So if your group chat is called Nude Volleyball Buddies, the name would be something like `NudeVolleyballBuddies_5tujptrnrm`. This directory has this structure:

```
[NudeVolleyballBuddies_5tujptrnrm]
├── gifs
│   └── [shared gifs]
├── photos
│   └── [shared photos]
├── videos
│   └── [shared videos]
├── files
│   └── [other shared files]
└── message_1.json
```

The data I need is in `message_1.json`. No clue why the `_1` sufix is needed. In my archive there was no `messasge_2.json` or any other variation.

These files can get pretty big, so don't be surprised if your fancy IDE implodes at the sight of it. The chat I want to analyze is about 5 years old, which resulted in over *a million lines* of JSON.

The JSON file is structured like this:

```json
{
  "participants": [
    { "name": "Ricardo Lopes" },
    { "name": "etc..." }
  ],
  "messages": [
    " (list of messages...) " 
  ],
  "title": "Nude Volleyball Buddies",
  "is_still_participant": true,
  "thread_type": "RegularGroup",
  "thread_path": "inbox/NudeVolleyballBuddies_5tujptrnrm"
}
```

Obviously I want to focus on `messages`. It's not just a list of strings, each message has this format:

```json
{
  "sender_name": "Ricardo Lopes",
  "timestamp_ms": 1565448249085,
  "content": "is it ok if i wear a sock",
  "reactions": [
    {
      "reaction": "\u00f0\u009f\u0098\u00a2",
      "actor": "Samuel Lopes"
    }
  ],
  "type": "Generic"
}
```

And I found what I was looking for! All the reactions listed right there.

// message reactions didn't exist until 2017
// https://newsroom.fb.com/news/2017/03/introducing-message-reactions-and-mentions-for-messenger/

# Reading the JSON from JavaScript

I already have my React project set up with [Create React App](https://github.com/facebook/create-react-app), but how do I access the data in the JSON from my JavaScript code? With a file input and the [FileReader API](https://developer.mozilla.org/en-US/docs/Web/API/FileReader):

```js
function App () {
  function handleReaderLoad (event: ProgressEvent) {
    const parsedObject = JSON.parse(event.target.result)
    console.log('parsed object', parsedObject)
  }

  function handleFileChange (event) {
    const reader = new FileReader()
    reader.onload = handleReaderLoad
    reader.readAsText(event.target.files[0])
  }

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
      />
    </div>
  )
}
```

So now I see the file input field on my page, and the parsed JavaScript object is logged to the console when I select the JSON:

// screenshot of file input console log

It can take a few seconds due to the absurd length. Now we just need to figure out how to read it.

# Parsing the data

Let's start simple. My first goal is to take my `messages_1.json` as input, and something like this as the output:

```js
output = [
  {
    name: "Ricardo Lopes",
    counts: {
      '😂': 10,
      '😍': 3,
      '😢': 4,
      '😠': 7,
      '😯': 3,
    },
  },
  // etc for every participant
]
```

The `participants` object from the original JSON already has a similar format, so I start with that. Using `parsedObject` defined in `handleReaderLoad`:

```js
const output = parsedObject.participants.map(({ name }) => ({
  name,
  counts: {},
}))
```

Our output is pretty much just the participant list from the JSON, with an extra field where I will place the reaction counts. Now I need to iterate the whole message list, and accumulate the reaction counts:

```js
parsedObject.messages.forEach(message => {
  // I will update the counts in the output object,
  // but need to find the correct participant to mutate.
  const outputParticipant = output.find(({ name }) => name === message.sender_name)

  // Increment the reaction counts for that participant
  message.reactions.forEach(({ reaction }) => {
    if (!outputParticipant.counts[reaction]) {
      outputParticipant.counts[reaction] = 1
    } else {
      outputParticipant.counts[reaction] += 1
    }
  })
})
```

This is how the logged output looks like:
// output log with broken emojis

Those don't look like any emojis I've ever seen. What gives?

Let's take a closer look to how reactions are encoded in the JSON provided by Facebook:

```js
"reaction": "\u00f0\u009f\u0098\u00a2"
```

What does that train of colourful characters mean? The `\u` prefix means the the following characters will be treated as a hexadecimal Unicode character code.

Every Unicode character has a numerical representation. For instance, [the hexadecimal representation of the capital letter S is `0053`](https://unicode-table.com/en/0053/). You can see how it works in JavaScript by typing `"\u0053"` in the console:

// \u0053 to S in the console

We can also do it the other way around:

// S to \u0053 in console

Looking at the Unicode table again, we can see [the hex code for the crying emoji is `1F622`](https://unicode-table.com/en/1F622/). So we can print it on the console and-

// \u1F622 in the console

Hm. That's not right either.

This is because `1F622` is bigger than `FFFF`, the biggest number you can represent with four hex digits. Since `\u` will only look at the following 4 digits, `\u1F622` actually gives us two characters, `\u1F62` (`ὢ`) and `2`.

In UTF-16, anything bigger than `FFFF` must be split into two codes. But these two codes still only represent a single character. Let's do it the other way around, then:

// emoji to code

Now we should be able to-

// code to emoji

Okay, wrong again... So it turns out [the JavaScript language doesn't actually use UTF-16](https://mathiasbynens.be/notes/javascript-encoding). Internally, it uses UCS-2, which isn't able to use the pairs of codes like we discussed before. So a pair of codes will be interpreted as two separate characters, until it is printed somewhere. When we actually try to print the string, the surrogate pairs are merged into a single character. The result is `"😢".length == 2` being true.

So let's try that again, taking into account that the emoji is actually composed by two pseudo-characters:

// double-code to emoji

Good. So the character code for `😢` is the surrogate pair `\uD83D\uDE22`. But that doesn't look at all like what Zuckerberg emailed me:

```js
"reaction": "\u00f0\u009f\u0098\u00a2"
```

It looks like there's four character codes there, but they can't be surrogate pairs because [they're not in the right range](https://mathiasbynens.be/notes/javascript-encoding#surrogate-pairs). So what are they?

Let's take a look at a bunch of possible encodings for this emoji. Do any of these seem familiar?

// Screenshot of the encoding at website

There it is! Turns out this is a UTF-8 encoding, with each byte represented as a hex number. But for some reason, they formatted it as if each byte was a Unicode code unit. Why? Who the fuck knows?

So how do we go from `\u00f0\u009f\u0098\u00a2` to `\uD83D\uDE22`?

Here's how to make the conversion:

```js
function decodeFBString (fbString) {
  // Convert from String to Array of character hex code
  const codeArray = (
    fbString.              // '\u00f0\u009f\u0098\u00a2'
    split('').             // ['\u00f0',\u009f',\u0098',\u00a2']
    map(char => (          // '\u00f0'
      char.charCodeAt(0)   // 0xf0
    )                      // [0xf0,0x9f,0x98,0xa2]
  );

  // Convert byte array back to text
  const byteArray = Uint8Array.from(codeArray);
  return new TextDecoder().decode(byteArray);
}
```

`TextDecoder` is the tool we need to convert from bytes to string, but it takes a byte array as input. So we need to go through our awkwardly formatted string and convert each character to a hex number.
