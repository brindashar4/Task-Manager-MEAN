const express = require('express');
const app = express();
const {mongoose} = require('./db/mongoose');
const bodyParser = require('body-parser');

//Load mongoose models
const { List,Task,User } = require('./db/models');
const jwt = require('jsonwebtoken');

/*Middleware */

//Load middleware
app.use(bodyParser.json());

//CORS HEADERS MIDDLEWARE
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id");

    res.header(
        'Access-Control-Expose-Headers',
        'x-access-token, x-refresh-token'
    );

    next();
});

//check whether the request has a valid JWT token
let authenticate = (req, res, next) => {
    let token = req.header('x-access-token');

    //verify the JWT
    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
        if(err) {
            // there was an error
            //jwt was invalid - do not authenticate
            res.status(401).send(err);
        } else {
            //jwt is valid
            req.user_id = decoded._id;
            next();
        }
    })
}

//Middleware to verify refresh token, which will verify the session
let verifySession = (req, res, next) => {
    //grab refresh token from the header
    let refreshToken = req.header('x-refresh-token');

    //grab the id from the request header
    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then((user) => {
        if(!user) {
            //user is not found
            return Promise.reject({
                'error': 'User not found. Make sure the refresh token and user id are valid'
            });
        }

        //if the code reaches here, the user was found, therefore, the refresh token exists in the database
        //but we still have to check whether it has expired or not
        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        let isSessionValid = false;

        user.sessions.forEach((session) => {
            if(session.token === refreshToken) {
                //check if the session has expired
                if(User.hasRefreshTokenExpired(session.expiresAt)===false) {
                    //refresh token not expired
                    isSessionValid = true;
                }
            }
        });

        if(isSessionValid) {
            next();
        } else {
            return Promise.reject({
                'error': 'Refresh token has expired or the session is invalid'
            })
        }
    }).catch((e) => {
        res.status(401).send(e); //401 - unauthorised
    })
}

/* End of middleware */

//Route handlers

//List routes

/*
GET /lists - to get all the lists
*/
app.get('/lists', authenticate, (req,res) => {
    //returning an array of the lists of the authenticated user from the database
    List.find({
        _userId: req.user_id
    }).then((lists) => {
        res.send(lists);
    });
});

/**
 * POST /lists - to create a list
 */
app.post('/lists', authenticate, (req,res) => {
    //creating a new list and return the new list document back to the user
    //list information fields will be passed in via JSON req body
    let title = req.body.title;
    let newList = new List({
        title,
        _userId: req.user_id
    });
    newList.save().then((listDoc) => {
        //full list document is returned
        res.send(listDoc);
    })
});

/**
 * PATCH /lists/:id - to update the specified list
 */
app.patch('/lists/:id', authenticate, (req,res) => {
    //updating the list
    List.findOneAndUpdate({ _id: req.params.id, _userId: req.user_id }, {
        $set: req.body
    }).then(() => {
        res.send({ 'message': 'updated successfully' });
    });
});

/**
 *DELETE /lists/:id - delete the specified list 
 */
app.delete('/lists/:id', authenticate, (req,res) => {
    //deleting the specified list
    List.findOneAndRemove({
        _id: req.params.id,
        _userId: req.user_id
    }).then((removedListDoc) => {
        res.send(removedListDoc);

        //delete tasks that are under the deleted list
        deleteTasksFromList(removedListDoc._id);
    })
});

/**
 * GET all tasks from the specified list
 */
app.get('/lists/:listId/tasks', authenticate, (req,res) => {
    //return all tasks in that particular list
    Task.find({
        _listId: req.params.listId
    }).then((tasks) => {
        res.send(tasks);
    })
});

/**
 * GET a sepcified task from a specified list
 */
app.get('/lists/:listId/tasks/:taskId', (req,res) => {
    Task.findOne({
        _id: req.params.taskId,
        _listId: req.params.listId
    }).then((task) => {
        res.send(task);
    })
});

app.post('/lists/:listId/tasks', authenticate, (req,res) => {
    //check whether the logged in user has access to the list id specified
    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if(list) {
            //list object is valid
            //then the currently authenticated user can create tasks
            return true;
        }
        //else - the list object is undefined
        return false;
    }).then((canCreateTask) => {
        if(canCreateTask) {
            //Create a new task in the list
            let newTask = new Task({
                title: req.body.title,
                _listId: req.params.listId
            });
            newTask.save().then((newTaskDoc) => {
                res.send(newTaskDoc);
            })
        } else {
            res.sendStatus(404);
        }
    })    
})

/**
 * PATCH /list/:listId/tasks/:taskId; update task
 */
app.patch('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if(list) {
            //list object is valid
            //then the currently authenticated user can update the specified task
            return true;
        }
        //else - the list object is undefined
        return false;
    }).then((canUpdateTasks) => {
        if(canUpdateTasks) {
            //the currently authenticated user can update tasks
            //update an existing task in the specified list
            Task.findOneAndUpdate({
                _id: req.params.taskId,
                _listId: req.params.listId
            }, {
                $set: req.body
                }
            ).then(() => {
                res.send({message: 'Updated!'});
            })
        } else {
            res.sendStatus(404);
        }
    }) 
});

/**
 * DELETE /lists/:listId/tasks/:taskId: Delete task
 */
app.delete('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {

    List.findOne({
        _id: req.params.listId,
        _userId: req.user_id
    }).then((list) => {
        if(list) {
            //list object is valid
            //then the currently authenticated user can update the specified task
            return true;
        }
        //else - the list object is undefined
        return false;
    }).then((canDeleteTasks) => {
        if(canDeleteTasks) {
            Task.findOneAndRemove({
                _id: req.params.taskId,
                _listId: req.params.listId
            }).then((removedTaskDoc) => {
                res.send(removedTaskDoc);
            })
        } else {
            res.sendStatus(404);
        }
    });
});


/*User routes */

/**
 * POST /users
 * Purpose: Sign up
 */
app.post('/users', (req, res) => {
    let body = req.body;
    let newUser = new User(body);

    newUser.save().then(() => {
        return newUser.createSession();
    }).then((refreshToken) => {
        //Session created sucessfully - refreshToken returned.
        //now we generate an access auth token for the user

        return newUser.generateAccessAuthToken().then((accessToken) => {
            // access auth generated successfully , now we return an object containing the auth tokens
            return {accessToken, refreshToken}
        });
    }).then((authTokens) => {
        //we construct and send the response to the user with their auth tokens  in the header and the user object in the body
        res
            .header('x-refresh-token', authTokens.refreshToken)
            .header('x-access-token', authTokens.accessToken)
            .send(newUser);
    }).catch((e) => {
        res.status(400).send(e);
    })
})

/**
 * POST /users/login
 * Purpose: login
 */
app.post('/users/login', (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email, password).then((user) => {
        return user.createSession().then((refreshToken) => {
            //session created successfully - refreshtoken returned
            //generate access auth token for the user
            return user.generateAccessAuthToken().then((accessToken) => {
                // access auth generated successfully , now we return an object containing the auth tokens
                return {accessToken, refreshToken}
            });
        }).then((authTokens) => {
            res
                .header('x-refresh-token', authTokens.refreshToken)
                .header('x-access-token', authTokens.accessToken)
                .send(user);
        })
    }).catch((e) => {
        res.status(400).send(e);
    });
})

/**
 * GET /users/me/access-token
 * Purpose: generates and returns access token
 */
app.get('/users/me/access-token', verifySession, (req, res) => {
    //we know that the user/caller is authenticated and we have the user_id available to us
    req.userObject.generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch((e) => {
        res.status(400).send(e);
    });
})

/* Helper methods */
let deleteTasksFromList = (_listId) => {
    Task.deleteMany({
        _listId
    }).then(() => {
        console.log("Tasks from " + _listId + " were deleted");
    });
}

app.listen(3000, () => {
    console.log("Server is listening on port 3000");
})