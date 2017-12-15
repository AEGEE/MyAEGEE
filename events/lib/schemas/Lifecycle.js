const mongoose = require('mongoose');
const AccessObject = require('../schemas/AccessObject');
const Status = require('../schemas/Status');

const transitionSchema = mongoose.Schema({
  from: String, // storing only name of the status there. This field can be null.
  to: { type: String, required: true }, // and also there
  allowedFor: { type: AccessObject, required: true },
}, { _id: false, minimize: false });

const lifecycleSchema = mongoose.Schema({
  eventType: { type: String, required: true },
  transitions: { type: [transitionSchema], required: true },
  statuses: { type: [Status], required: true },
  initialStatus: { type: String, required: true },
}, { _id: false, minimize: false });

lifecycleSchema.pre('validate', function validate(next) {
  // Checking if there are at least 1 status
  if (!this.statuses || this.statuses.length === 0) {
    this.invalidate('statuses', 'Need at least 1 status.');
  }

  // Checking if there is at least 1 transition
  if (!this.transitions || this.transitions.length === 0) {
    this.invalidate('transitions', 'Need at least 1 transition.');
  }

  // Checking if there are no duplicate statuses
  const statusesNames = this.statuses.map(status => status.name);
  if (new Set(statusesNames).size !== statusesNames.length) {
    this.invalidate('statuses', 'There are many statuses with the same name.');
  }

  // Checking if the initialStatus is actually in the list of statuses.
  if (!statusesNames.includes(this.initialStatus)) {
    this.invalidate('statuses', `No such status: ${this.initialStatus}.`);
  }

  // Checking if each transition's 'from' and 'to' statuses are included.
  for (const transition of this.transitions) {
    // There can be transitions where 'from' statuses are omitted (for creating events).
    if (transition.from && !statusesNames.includes(transition.from)) {
      this.invalidate('transitions', `The 'from' status of the transition doesn't exist: ${transition.from}.`);
    }
    if (!statusesNames.includes(transition.to)) {
      this.invalidate('transitions', `The 'to' status of the transition doesn't exist: ${transition.to}.`);
    }
  }

  // Checking if there is a create transition ('from' status == null, 'to' status == initialStatus)
  const createTransition = this.transitions.find(t => !t.from && t.to === this.initialStatus);

  if (!createTransition) {
    this.invalidate('transitions', `No transition for creating event (null => ${this.initialStatus}) is specified.`);
  }

  return next();
});

module.exports = lifecycleSchema;
