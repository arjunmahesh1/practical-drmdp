// Documentation media identify the task, never an evaluated policy or severity.
export const environments = {
  Walker2d: {image:'https://gymnasium.farama.org/_images/walker2d.png', credit:'Gymnasium task reference', url:'https://gymnasium.farama.org/environments/mujoco/walker2d/'},
  HalfCheetah: {image:'https://gymnasium.farama.org/_images/half_cheetah.png', credit:'Gymnasium task reference', url:'https://gymnasium.farama.org/environments/mujoco/half_cheetah/'},
  Pusher: {image:'https://gymnasium.farama.org/_images/pusher.png', credit:'Gymnasium task reference', url:'https://gymnasium.farama.org/environments/mujoco/pusher/'},
  PickCube: {image:'https://maniskill.readthedocs.io/en/latest/_static/env_thumbnails/PickCube-v1_rt_thumb_first.png', credit:'ManiSkill task reference', url:'https://maniskill.readthedocs.io/en/latest/tasks/table_top_gripper/index.html#pickcube-v1'},
  LunarLander: {image:'https://gymnasium.farama.org/_images/lunar_lander.gif', credit:'Gymnasium nominal example', url:'https://gymnasium.farama.org/environments/box2d/lunar_lander/'}
};

export function parameterNote(environment, axis) {
  const pick=environment.startsWith('PickCube');
  const notes={
    translation_gain:'Scales the x/y/z gripper translation commands before clipping to the action bounds. The gripper-opening command is unchanged. Values are action multipliers, not metres.',
    translation_noise:'Independent Gaussian noise is added to each translation command at every step. The amplitude is a fraction of the action half-range, not a distance in metres. Gripper opening is unchanged.',
    translation_replacement:'At each step, this probability replaces the entire translation vector with a uniformly sampled valid command. Gripper opening is unchanged.',
    object_mass:pick?'Multiplies the cube mass. The policy and its trained parameters stay fixed.':'Multiplies the manipulated object mass. The policy stays fixed.',
    cube_mass:'Multiplies the cube mass. The policy and its trained parameters stay fixed.',
    contact_friction:'Scales contact friction in the task. The robot policy and cube geometry stay fixed; 1× is nominal.',
    goal_height:'Multiplies the target lift height relative to the initial cube height. This changes the task target, not the policy.',
    goal_distance:'Scales the object-to-goal displacement. This changes the task target, not the policy.',
    gaussian_action_noise:'Gaussian action noise is added before bounded control is applied. Values are in the evaluator’s action-noise units.',
    action_replacement:'Per-step probability of replacing the action with a uniformly sampled valid action.',
    mass:'Scales the masses specified by this evaluation axis; 1× is the nominal model.',
    friction:'Scales contact friction. 1× is nominal. A flat return curve is an observed result, not evidence that all contact physics is irrelevant.',
    actuator_strength:'Scales actuator strength while leaving the learned policy fixed.',
    joint_damping:'Scales joint damping while leaving the learned policy fixed.'
  };
  return notes[axis] || 'The displayed values are the saved evaluation grid. The policy is fixed across conditions; larger numeric values are not necessarily more severe.';
}
