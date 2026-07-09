# Omi — Game Rules Specification

Omi (also known as Oombi) is a traditional Sri Lankan trick-taking partnership card game belonging to the Whist family. Its defining feature is that the trump suit is selected halfway through the deal, before the declarer has seen their complete hand.

This document specifies the rules in sufficient detail to implement a digital version of the game.

---

# 1. Players & Teams

- Exactly **4 players**.
- Two fixed partnerships.
- Partners always sit opposite each other.

Example:

```
      P1
P2          P4
      P3
```

Teams:

- Team A = P1 + P3
- Team B = P2 + P4

- Dealing and play proceed **counter-clockwise**.

---

# 2. Cards

A standard 52-card deck is used.

Only the following 32 cards are used during play:

```
A K Q J 10 9 8 7
```

of every suit.

Card ranking (highest → lowest):

```
A > K > Q > J > 10 > 9 > 8 > 7
```

The remaining twenty cards

```
2 3 4 5 6
```

of every suit are **not played**.

Instead they are used as scoring tokens.

- Clubs + Spades (10 black cards) belong to one team.
- Hearts + Diamonds (10 red cards) belong to the other team.

Each token is worth exactly one point.

During the game these cards are physically transferred between teams to keep score.

---

# 3. Deal

Dealer rotates to the player on the right after every hand.

For each hand:

1. Shuffle the 32-card play deck.
2. (Traditional rule) Offer the deck to the player on the dealer's left to cut.
3. Deal **4 cards** to each player.
4. The player on the dealer's **right** looks only at those four cards.
5. That player must immediately announce the trump suit.
6. Dealer deals another **4 cards** to every player.
7. Every player now has **8 cards**.

The trump suit cannot be changed once announced.

---

# 4. Play

The player who selected the trump suit leads the first trick.

For every trick:

1. Leader plays any card.
2. Turns proceed counter-clockwise.
3. Players **must follow the suit led** if they have one.
4. A player who has no card of the led suit may play any card, including a trump.

### Winning a Trick

If no trump card is played:

- Highest card of the led suit wins.

If one or more trump cards are played:

- Highest trump wins.

The winner:

- Collects the four cards.
- Places them face down in the team's trick pile.
- Leads the next trick.

The hand ends after all eight tricks have been played.

---

# 5. Scoring

After eight tricks:

Count the tricks won by each partnership.

## Normal Win

If the team that selected trump wins:

- **5, 6 or 7 tricks**
- They win **1 scoring token** from the opposing team's supply.

If the opposing team wins:

- **5, 6 or 7 tricks**
- They win **2 scoring tokens** from the trump team's supply.

This is the defining scoring rule of Omi: the team that chose trump is penalized more heavily if they fail to justify their trump selection.

## Kapothi

If either team wins **all 8 tricks**, they receive **3 scoring tokens** from the opposing team.

This is traditionally known as **Kapothi** (also called *Basthe* in some regions).

## 4–4 Tie (Hanging Hand)

If both teams win exactly four tricks:

- No scoring tokens are transferred.
- The hand is considered **hanging**.
- One bonus token is carried forward.

The next hand that produces a winner awards:

- the normal number of scoring tokens **plus one additional token**.

Examples:

- Trump team wins next hand with 6 tricks:
  - earns **2 tokens** instead of 1.

- Non-trump team wins next hand with 6 tricks:
  - earns **3 tokens** instead of 2.

Only one hanging bonus exists at a time.

---

# 6. Winning the Game

Each team begins with ten scoring tokens.

Whenever a team scores, the required number of tokens are transferred from the opposing team's supply.

The game ends immediately when one team has collected all ten tokens (or the opposing team no longer has enough tokens to pay).

That team wins the match.

---

# 7. Game State

```text
GameState:
    players: [P1, P2, P3, P4]

    teams:
        TeamA = (P1, P3)
        TeamB = (P2, P4)

    dealer: PlayerID

    trump_announcer: PlayerID

    trump_suit:
        Clubs
        Diamonds
        Hearts
        Spades

    hands:
        PlayerID -> 8 cards

    current_trick:
        [(PlayerID, Card)]

    trick_leader: PlayerID

    tricks_won:
        Team -> Integer

    scoring_tokens:
        Team -> Integer (0–10)

    hanging_bonus:
        Integer
        (0 or 1)

    phase:
        DEAL_FIRST_BATCH
        ANNOUNCE_TRUMP
        DEAL_SECOND_BATCH
        TRICK_PLAY
        HAND_END
        GAME_END
```

---

# 8. Turn Sequence

```
DEAL_FIRST_BATCH

↓

ANNOUNCE_TRUMP

↓

DEAL_SECOND_BATCH

↓

TRICK_PLAY
(8 tricks)

↓

HAND_END

↓

Update score

↓

Rotate dealer right

↓

Next hand

↓

GAME_END (when one team owns all scoring tokens)
```

---

# 9. Validation Rules

An implementation must reject:

- Playing out of turn.
- Announcing trump by anyone other than the player to the dealer's right.
- Changing the trump suit after announcement.
- Playing a card not in the player's hand.
- Failing to follow suit when holding a card of the led suit.
- Leading another trick before the previous trick has four cards.
- Playing after the hand has already ended.

The implementation must also enforce:

- Exactly 8 tricks per hand.
- Exactly 8 cards per player.
- Correct determination of trick winners.
- Correct handling of hanging hands.
- Correct transfer of scoring tokens.
- Automatic game termination once one team owns all scoring tokens.