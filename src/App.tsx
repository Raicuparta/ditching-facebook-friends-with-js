import React, {
  useState,
} from 'react'
import {
  countBy,
  map,
  flatten,
  uniq,
  compact,
  sortBy,
  filter,
  reverse,
} from 'lodash'

import './App.css'

function decodeFBString (fbString: string) {
  const codeArray = fbString.split('').map(char => char.charCodeAt(0))
  const byteArray = Uint8Array.from(codeArray)
  return new TextDecoder().decode(byteArray)
}

const App: React.FC = () => {
  const [participantList, setParticipantList] = useState<Participant[]>([])
  const [reactionList, setReactionList] = useState<string[]>([])

  function handleReaderLoad (event: ProgressEvent) {
    if (!event.target) {
      return
    }

    // Need to force this type since it seems the type definition for ProgressEvent is missing it.
    // https://stackoverflow.com/questions/35789498/
    const target = event.target as FileReaderEventTarget

    const parsedObject: ParsedObject = JSON.parse(target.result)
    const participants: ParticipantMap = {}

    function createParticipant (name: string) {
      participants[name] = {
        name: decodeFBString(name),
        reactions: {},
        reactionCount: 0,
        messageCount: 0,
        sentReactionCount: 0,
      }
    }

    // Get a list of all the possible reaction emojis
    setReactionList(
      uniq(compact(
        map(
          flatten(map(parsedObject.messages, 'reactions')),
          (reaction) => reaction && decodeFBString(reaction.reaction),
        )
      ))
    )

    parsedObject.messages.forEach(message => {
      const sender = message.sender_name

      if (!participants[sender]) {
        createParticipant(sender)
      }

      participants[sender].messageCount += 1

      if (!message.reactions) {
        return
      }

      const reactionCounts = countBy(message.reactions, 'reaction')

      Object.entries(reactionCounts).forEach(([reaction, count]) => {
        const decodedReaction = decodeFBString(reaction)

        if (participants[sender].reactions[decodedReaction] === undefined) {
          participants[sender].reactions[decodedReaction] = 0
        }
        participants[sender].reactions[decodedReaction] += count
        participants[sender].reactionCount += count
      })

      const actorCounts = countBy(message.reactions, 'actor')
      Object.entries(actorCounts).forEach(([actor, count]) => {
        if (!participants[actor]) {
          createParticipant(actor)
        }
        participants[actor].sentReactionCount += count
      })
    })

    const participantCount = filter(Object.values(participants), 'reactionCount').length

    const messageCountAverage = parsedObject.messages.length / participantCount

    Object.entries(participants).forEach(([, participant]) => {
      const {
        reactions,
        sentReactionCount,
        messageCount,
      } = participant

      const getCount = (emoji: string) => (reactions[emoji] || 0)

      const approval = getCount('👍')
      const disapproval = getCount('👎')
      const positiveEmotion = getCount('😆') + getCount('😍')
      const negativeEmotions = getCount('😢') + getCount('😠')
      const totalMessageFactor = Math.abs(messageCount - messageCountAverage) / (messageCountAverage)
      const positiveFactor = (2 * approval + 3 * positiveEmotion + sentReactionCount)
      const negativeFactor = (2 * disapproval + 3 * negativeEmotions)

      if (messageCount === 0) {
        participant.score = 0
      } else {
        participant.score = Math.round(((positiveFactor - negativeFactor)) / totalMessageFactor) / 100
      }
    })

    setParticipantList(reverse(sortBy(filter(Object.values(participants), 'reactionCount'), 'score')))
  }

  function handleFileChange (event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files) {
      return
    }
    const reader = new FileReader()
    reader.onload = handleReaderLoad
    reader.readAsText(event.target.files[0])
  }

  // function perMessage (participant: Participant, count: number) {
  //   return Math.round((count / participant.messageCount) * 1000) / 1000
  // }

  return (
    <div className="App">
      <header className="App-header">
        <input
          type="file"
          onChange={handleFileChange}
        />
        <table>
          <thead>
            <tr>
              <td>
                User
              </td>
              {reactionList.map(reaction => (
                <td key={reaction}>
                  {reaction}
                </td>
              ))}
              <td>
                Reactions Received
              </td>
              <td>
                Reactions Sent
              </td>
              <td>
                Total Messages
              </td>
              <td>
                Score
              </td>
            </tr>
          </thead>
          <tbody>
            {participantList.map(participant => (
              <tr key={participant.name}>
                <td>
                  {participant.name}
                </td>
                {reactionList.map(reaction => {
                  const reactionObject = Object.entries(participant.reactions)
                    .find(([userReaction, count]) => (
                      userReaction === reaction
                    ))

                  if (!reactionObject) {
                    return (
                      <React.Fragment key={reaction}>
                        <td>-</td>
                      </React.Fragment>
                    )
                  }

                  const count = reactionObject[1]

                  return (
                    <React.Fragment key={reaction}>
                      <td>
                        {count}
                      </td>
                    </React.Fragment>
                  )
                })}
                <td>
                  {participant.reactionCount}
                </td>
                <td>
                  {participant.sentReactionCount}
                </td>
                <td>
                  {participant.messageCount}
                </td>
                <td>
                  {participant.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </header>
    </div>
  )
}

export default App
