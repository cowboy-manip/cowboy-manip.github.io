# Real World Evaluation Videos

Each scene folder powers one tile in the Real World Evaluations grid.
The page uses one global Previous/Next control for all scenes. Pressing it advances every scene to the same rollout index; scenes with fewer videos wrap around.

Default naming convention:

- `rollout.mp4`
- `rollout_1.mp4`
- `rollout_2.mp4`
- ...
- `rollout_8.mp4`

For arbitrary filenames or more than eight rollouts, add a `rollouts.json` file inside the scene folder:

```json
{
  "videos": [
    "rollout_kitchen.mp4",
    "rollout_shelf.mp4",
    "rollout_drawer.mp4"
  ]
}
```
