interface ParsedObject {
  messages: Message[]
}

interface Message {
  sender_name: string
  reactions: Reaction[]
}

interface Reaction {
  reaction: string
}

interface ParticipantMap {
  [name: string]: Partifipant
}

interface Participant {
  name: string
  reactionCount: number
  messageCount: number
  reactions: {
    [reaction: string]: number
  }
}

interface FileReaderEventTarget extends EventTarget {
  result: string
}
