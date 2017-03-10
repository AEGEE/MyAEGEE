// Could theoretically be split into a seperate server, doesn't interact with the rest of the module
// Idea: implement in elxir?
// Idea accepted =)

const log = require('./config/logger.js');
const restify = require('restify');
const helpers = require('./helpers.js');

const Comment = require('./models/Comment');

exports.listComments = (req, res, next) => {
  Comment
    .find({ event_id: req.params.event_id })
    .exec((err, comments) => {
      if (err) {
        log.error('Could not retrieve comments', err);
        return next(new restify.InternalError());
      }

      res.json({
        success: true,
        data: comments,
      });
      return next();
    });
};

exports.createComment = (req, res, next) => {
  const data = req.body;

  // Fetch user-data
  helpers.getUserById(req.header('x-auth-token'), data.user.foreign_id, (err, user) => {
    if (err) {
      log.error('Could not fetch user', err);
      return next(new restify.InternalError());
    }

    data.user.antenna_id = user.antenna_id;
    data.user.antenna_name = user.antenna_name;
    data.user.name = `${user.first_name} ${user.last_name}`;
    data.user.profile_url = user.seo;

    const comment = new Comment(data);
    return comment.save((saveError) => {
      if (saveError) {
        return next(new restify.InternalError({
          body: {
            success: false,
            message: saveError.message,
          },
        }));
      }

      res.json({
        success: true,
        message: 'Comment saved successfully',
      });
      return next();
    });
  });
};
