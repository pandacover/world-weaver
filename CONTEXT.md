# World Weaver

World Weaver turns a Premise into a Short Film: a structured Screenplay of Scenes, each rendered as Media (video clip or still), played in sequence by the Film Player.

## Language

**Premise**:
The user's short free-text idea that seeds generation.
_Avoid_: prompt (when referring to the user's input), query

**Screenplay**:
The structured plan for a Short Film: title, logline, style, and ordered Scenes.
_Avoid_: script dump, story outline

**Scene**:
One unit of the Screenplay with narration/dialogue, a visual brief, and duration intent.
_Avoid_: shot (unless nested later), beat (ambiguous)

**Media**:
The rendered visual asset for a Scene — either a video clip or a still image.
_Avoid_: asset, attachment

**Short Film**:
The finished package: Screenplay plus per-Scene Media, ready for playback.
_Avoid_: movie, project, generation job (use Film Job for in-flight work)

**Film Job**:
An in-flight generation run from Premise to Short Film, with staged progress.
_Avoid_: task, request

**Film Player**:
The in-app viewer that plays Media in Scene order with captions.
_Avoid_: carousel, gallery
