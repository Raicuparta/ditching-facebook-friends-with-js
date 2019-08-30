import React, {
  useState,
} from 'react'
import {
  countBy,
  map,
  flatten,
  uniq,
  compact,
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
        reactionsSentCount: 0,
      }
    }

    // Get a list of all the possible reaction emojis
    setReactionList(
      uniq(compact(
        map(
          flatten(map(parsedObject.messages, 'reactions')),
          'reaction',
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
        if (participants[sender].reactions[reaction] === undefined) {
          participants[sender].reactions[reaction] = 0
        }
        participants[sender].reactions[reaction] += count
        participants[sender].reactionCount += count
      })

      const actorCounts = countBy(message.reactions, 'actor')
      Object.entries(actorCounts).forEach(([actor, count]) => {
        if (!participants[actor]) {
          createParticipant(actor)
        }
        participants[actor].reactionsSentCount += count
      })
    })

    setParticipantList(Object.values(participants))
  }

  function handleFileChange (event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files) {
      return
    }
    const reader = new FileReader()
    reader.onload = handleReaderLoad
    reader.readAsText(event.target.files[0])
  }

  function perMessage (participant: Participant, count: number) {
    return Math.round((count / participant.messageCount) * 1000) / 1000
  }

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
                <td key={reaction} colSpan={2}>
                  {decodeFBString(reaction)}
                </td>
              ))}
              <td>
                Reactions Received
              </td>
              <td>
                Reactions Sent
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
                      <td>
                        {perMessage(participant, count)}
                      </td>
                    </React.Fragment>
                  )
                })}
                <td>
                  {participant.reactionCount}
                </td>
                <td>
                  {participant.reactionsSentCount}
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
