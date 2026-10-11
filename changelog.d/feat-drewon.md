- **Say which memories you drew on.** `session_end` and `chapter` take an optional `drewOn`
  list: the ids of memories shown this session (a footnote, a recall result) that changed
  what was done or said. Each gets half a use, so it holds longer: once a day per memory, at
  most three per ask, and only ids this session was actually shown. An id it was not shown,
  a superseded memory or one faded under a newer one is refused by name. Opening it later
  the same day still lifts it to a full use. A wake line is still credited by opening it.
- **Each further use adds less.** What a memory gains from being used now levels off gently
  instead of climbing in a straight line to a cap at five uses.
- **The doctor counts it.** The Credit line says how many `drewOn` credits landed over the
  last week, beside the newest boundary's reading.
