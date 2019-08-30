# Ditching useless friends with Facebook data and JavaScript

Friendships are hard to maintain. So much energy is wasted maintaining friendships that might not actually provide any tangible returns. I find myself thinking "Sure I've known her since kindergarten, she introduced me to my wife, and let me crash at her place for 6 months when I was evicted, but is this *really* a worthwhile friendship?".

I need to decide which friends to ditch. But what's the criteria? Looks? Intelligence? Money?

After a long debate with myself I reached a conclusion: sense of humor. I should keep the funniest friends and get rid of everyone who bums me out. Plus, laughter is the best medicine, so there will be some health benefits.

Surely, sense of humor is subjective. There's no way to benchmark it empirically, right? **WRONG**. There is one surefire way to way to gauge sense of humor: *the amount of laughing emoji reactions received on Facebook Messenger.*

![And the bartender said "why the long face" lmao. 12 laughing emoji reactions.](https://i.imgur.com/ztbplsK.png)

Obviously counting manually is out of the question; I need to automate this task.

# Getting the data

Scraping the chats would be too slow. I think there's an API, but it looks scary and the documentation has so many words! I eventually found a way to get the data I need:

![Facebook data download page](https://i.imgur.com/nl0GO6g.png)

[Facebook lets me download all the deeply personal information](https://www.facebook.com/help/1701730696756992) they collected on me over the years in an easily readable JSON format. So kind of them! I make sure to select only the data I need (messages), and select the lowest image quality, to keep the archive as small as possible. It can take hours or even days to generate.

The next day, I get an email notifying me that the archive is ready to download (all *8.6 GB* of it) under the "Available Copies" tab. The zip file has the following structure:

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

The directory I am interested in is `inbox`. The directories I marked with `[chats]` have this structure:

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

The data I need is in `message_1.json`. No clue why the `_1` sufix is needed. In my archive there was no `messasge_2.json` or any other variation. The full path would be `messages/inbox/NudeVolleyballBuddies_5tujptrnrm/message_1.json`.

These files can get pretty big, so don't be surprised if your fancy IDE faints at the sight of it. The chat I want to analyze is about 5 years old, which resulted in over *a million lines* of JSON.

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
    },
    {
      "reaction": "\u00f0\u009f\u0098\u00a2",
      "actor": "Carmen Franco"
    }
  ],
  "type": "Generic"
}
```

And I found what I was looking for! All the reactions listed right there.

# Reading the JSON from JavaScript

To access the data in the JSON from JavaScript, we can use the [FileReader API](https://developer.mozilla.org/en-US/docs/Web/API/FileReader):

```html
<input type="file" accept=".json" onChange="handleChange(this)">
```
```js
function handleChange(target) {
  const reader = new FileReader();
  reader.onload = handleReaderLoad;
  reader.readAsText(target.files[0]);
}

function handleReaderLoad (event) {
  const parsedObject = JSON.parse(event.target.result);
  console.log('parsed object', parsedObject);
}
```

So now I see the file input field on my page, and the parsed JavaScript object is logged to the console when I select the JSON. It can take a few seconds due to the absurd length. Now we just need to figure out how to read it.

# Parsing the data

Let's start simple. My first goal is to take my `messages_1.json` as **input**, and something like this as the **output**:

```js
output = [
  {
    name: "Ricardo Lopes",
    counts: {
      😂: 10,
      😍: 3,
      😢: 4,
    },
  },
  {
    name: "Samuel Lopes",
    counts: {
      😂: 4,
      😍: 5,
      😢: 12,
    },
  },
  // etc for every participant
]
```

The `participants` object from the original JSON already has a similar format. Just need to add that `counts` field:

```js
const output = parsedObject.participants.map(({ name }) => ({
  name,
  counts: {},
}))
```

Now I need to iterate the whole message list, and accumulate the reaction counts:

```js
parsedObject.messages.forEach(message => {
  // Find the correct participant in the output object
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

![JavaScript console Output. Two participants, with reaction counts, but with weird characters instead of emojis](https://i.imgur.com/kd0Fqks.png)

Those don't look like any emojis I've ever seen. What gives?

# Decoding the reaction emoji

I grab one message as an example, and it only has one reaction: the crying emoji (😢). Checking the JSON file, this is what I find:

```js
"reaction": "\u00f0\u009f\u0098\u00a2"
```

How does this character train relate to the crying emoji?

It may not look like it, but this string is four characters long:

* 0: `\u00f0`
* 1: `\u009f`
* 2: `\u0098`
* 3: `\u00a2`

In JavaScript, `\u` is a prefix that denotes an escape sequence. This particular escape sequence starts with `\u`, followed by exactly four hexadecimal digits. It represents a Unicode character in UFT-16 format.

For instance, [the Unicode hex code of the capital letter S is `0053`](https://unicode-table.com/en/0053/). You can see how it works in JavaScript by typing `"\u0053"` in the console:

![JavaScript Console. "\u0053" as input, "S" as output](https://i.imgur.com/KfIY8Lc.png)

Looking at the Unicode table again, we can see [the hex code for the crying emoji is `1F622`](https://unicode-table.com/en/1F622/). This is longer than four digits, so simply using `\u1F622` wouldn't work. There are two ways around this:

* [UFT-16 surrogate pairs](https://en.wikipedia.org/wiki/UTF-16#U+010000_to_U+10FFFF). This splits the big hex number into two smaller 4-digit numbers. In this case, the crying emoji would be represented as `\ud83d\ude22`.

* Use the Unicode code point directly, using a slightly different format: `\u{1F622}`. Notice the curly brackets wrapping the code.

In the JSON, we have four character codes without curly brackets, and none of them can be surrogate pairs because [they're not in the right range](https://mathiasbynens.be/notes/javascript-encoding#surrogate-pairs).

So what are they?

Let's take a look at a bunch of [possible encodings for this emoji](https://graphemica.com/%F0%9F%98%A2). Do any of these seem familiar?

![graphemica.com's page on the crying emoji. The encoding for UTF-8 (hex) is "0xF0 0x9F 0x98 0xA2"](https://i.imgur.com/Y18GlSx.png)

That's pretty close! Turns out this is a UTF-8 encoding, in hex format. But for some reason, each byte is written as a Unicode character in UTF-16 format.

Knowing this, how do we go from `\u00f0\u009f\u0098\u00a2` to `\uD83D\uDE22`?

We need to extract each character as a byte, and then merge the bytes back together as a UTF-8 string:

```js
function decodeFBEmoji (fbString) {
  // Convert String to Array of hex codes
  const codeArray = (
    fbString  // starts as '\u00f0\u009f\u0098\u00a2'
    .split('')
    .map(char => (
      char.charCodeAt(0)  // convert '\u00f0' to 0xf0
    )
  );  // result is [0xf0, 0x9f, 0x98, 0xa2]

  // Convert plain JavaScript array to Uint8Array
  const byteArray = Uint8Array.from(codeArray);

  // Decode byte array as a UTF-8 string
  return new TextDecoder('utf-8').decode(byteArray);  // '😢'
}
```

So now we have what we need to properly render our results:

![JavaScript console Output. Two participants, with reaction counts, and now showing correct emojis](https://i.imgur.com/9hOSokB.png)

# Selecting a friend to ditch

In this part of the article I'll need to use advanced calculus techniques that will overwhelm most of the readers. Do not be discouraged, it will make sense in the end.

For this equation, I need some variables:

* Total message count for participant (**T**)
* Total reactions sent by participant (**RS**)
* Global average message count per participant (**AVG**)

I split the six possible reactions into four categories:

* 👍: Approval (**A**)
* 👎: Disapproval (**D**)
* 😆 and 😍: Positive emotion (**PE**)
* 😢 and 😠: Negative emotion (**NE**)

The final equation is:

![Equation: (2A + 3PE + SR) - (2D + 3NE)/(abs(T - AVG) / AVG)](https://i.imgur.com/Jw4JrIO.png)

[Click here if you wanna learn how I reached this equation](https://i.imgur.com/g7mvdGT.png)

In JavaScript it would go something like this:

```js
participants.forEach((participant) => {
  const {
    reactions,
    sentReactionCount,
    messageCount,
  } = participant

  const approval = reactions['👍']
  const disapproval = reactions['👎']
  const positiveEmotion = reactions['😆'] + reactions['😍']
  const negativeEmotions = reactions['😢'] + reactions['😠']

  const positiveFactor = (2 * approval + 3 * positiveEmotion + sentReactionCount)
  const negativeFactor = (2 * disapproval + 3 * negativeEmotions)
  const totalMessageFactor = Math.abs(messageCount - messageCountAverage) / (messageCountAverage)

  participant.score = (positiveFactor - negativeFactor) / totalMessageFactor
})
```

Displaying the information in table form makes it easier to parse:

![Results table](https://i.imgur.com/9HbsshT.png)

Note: Due to privacy concerns I replaced my friend's real names with their home addresses.

# Goodbye

With a quick look at the table I can finally decide who doesn't deserve my friendship anymore.

![Deleting Samuel Lopes from Facebook](https://i.imgur.com/aZWaG77.gif)

Farewell!
