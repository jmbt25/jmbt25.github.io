# Mini World — Video Transcript

Full transcript of the ~3-minute architecture walkthrough on YouTube:
**[How Mini World Was Built](https://www.youtube.com/watch?v=MrhfNMjAs5Y)**

The video and voiceover are AI-generated; the code is mine.

---

## 1. Title Card

So someone on Reddit asked how I made this. Here's the honest answer — every part of it.

## 2. The Honest Backstory

I started this project yesterday morning. I'd never written 3D code before. The whole thing — the world, the creatures, the civilizations, the awareness layer — came together in about a day, just by talking to Claude.

## 3. Architecture Overview

Here's the entire architecture. A world generator seeds a grid. Entities live in a registry. A simulation manager updates them about twelve times a second. A renderer draws them sixty times a second. And in the middle, one tiny event bus connects everything.

## 4. Two Loops

The whole project rests on two independent loops.

The simulation loop runs on a `setInterval`, twelve ticks per second. It iterates every entity, decides what they should do, and mutates the world. It knows nothing about WebGL.

The render loop runs on `requestAnimationFrame`, sixty frames per second. It reads the world's current state and draws it. It never mutates anything.

Two loops. They never touch each other.

## 5. The Event Bus

So how do they communicate? With sixteen lines of code.

This is the entire event bus. There's `emit` — meaning "this thing just happened." And there's `on` — meaning "tell me when that thing happens."

When a creature is born, the simulation calls `emit`. The civilization manager, the UI, and the awareness layer all hear it. One event. Three listeners. Zero coupling.

## 6. InstancedMesh

Now for the rendering trick. Drawing five hundred sheep one at a time would melt your GPU. Each one is a draw call, and the framerate collapses.

The fix is called `InstancedMesh`. You upload one geometry to the GPU, plus a list of instance matrices — position, rotation, scale, color. The GPU draws all five hundred copies in a single call.

Each creature is split into five body parts. Each part gets its own `InstancedMesh`. They share the same instance index per logical entity. Add a little color jitter, and a herd of clones suddenly reads as a herd of individuals.

## 7. Tile-Step Smoothing

There's one more visual trick. The simulation moves creatures one full tile at a time, twelve times a second. If the renderer drew that directly, everything would teleport.

So every step records the previous tile and the current tile. Then the renderer interpolates between them, with a smoothstep curve, sixty times a second. Combined with a Y-axis rotation, creatures slide and pivot — instead of popping.

## 8. Layered Features

The biggest lesson I learned: don't bolt features into the loop. Layer them on top.

The base sim is plants, herbivores, predators. Civilizations sit outside it and just listen for events. The Black Mirror awareness layer sits outside that and listens too.

You can delete the entire awareness system by removing three files and four lines from `main`. The base sim keeps running. That's the whole payoff for keeping concerns layered.

## 9. Call to Action

Every line of this is on GitHub. It's MIT licensed. Fork it, break it, make it your own.

You don't need a course to build something like this. You need an idea, an afternoon, and the willingness to ask your AI two hundred questions.

Go build something weird.
