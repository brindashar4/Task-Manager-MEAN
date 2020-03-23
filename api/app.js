const express = require('express');
const app = express();
const {mongoose} = require('./db/mongoose');
const bodyParser = require('body-parser');

//Load mongoose models
const { List,Task } = require('./db/models');

//Load middleware
app.use(bodyParser.json());

//CORS HEADERS MIDDLEWARE
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

//Route handlers

//List routes

/*
GET /lists - to get all the lists
*/
app.get('/lists', (req,res) => {
    //returning an array of all the lists from the database
    List.find({}).then((lists) => {
        res.send(lists);
    });
});

/**
 * POST /lists - to create a list
 */
app.post('/lists', (req,res) => {
    //creating a new list and return the new list document back to the user
    //list information fields will be passed in via JSON req body
    let title = req.body.title;
    let newList = new List({
        title
    });
    newList.save().then((listDoc) => {
        //full list document is returned
        res.send(listDoc);
    })
});

/**
 * PATCH /lists/:id - to update the specified list
 */
app.patch('/lists/:id', (req,res) => {
    //updating the list
    List.findOneAndUpdate({ _id: req.params.id }, {
        $set: req.body
    }).then(() => {
        res.sendStatus(200);
    });
});

/**
 *DELETE /lists/:id - delete the specified list 
 */
app.delete('/lists/:id', (req,res) => {
    //deleting the specified list
    List.findOneAndRemove({
        _id: req.params.id
    }).then((removedListDoc) => {
        res.send(removedListDoc);
    })
});

/**
 * GET all tasks from the specified list
 */
app.get('/lists/:listId/tasks', (req,res) => {
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

app.post('/lists/:listId/tasks', (req,res) => {
    //Create a new task in the list
    let newTask = new Task({
        title: req.body.title,
        _listId: req.params.listId
    });
    newTask.save().then((newTaskDoc) => {
        res.send(newTaskDoc);
    })
})

/**
 * PATCH /list/:listId/tasks/:taskId; update task
 */
app.patch('/lists/:listId/tasks/:taskId', (req,res) => {
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
});

/**
 * DELETE /lists/:listId/tasks/:taskId: Delete task
 */
app.delete('/lists/:listId/tasks/:taskId', (req,res) => {
    Task.findOneAndRemove({
        _id: req.params.taskId,
        _listId: req.params.listId
    }).then((removedTaskDoc) => {
        res.send(removedTaskDoc);
    })
});

app.listen(3000, () => {
    console.log("Server is listening on port 3000");
})