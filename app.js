const express = require("express");
const bodyParser = require("body-parser");
const uuid = require("uuid");
const kvfs = require("kvfs")(".data");

let app = express();

app.use(bodyParser.json());

app.use(function cors(req, res, next) {
    res.set("Access-Control-Allow-Methods", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Allow-Origin", "*");
    next();
});

app.post("/toilets", (req, res) => {
    let { name, longitude, latitude } = req.body;

    if(!name) {
        return res.status(400).send({ error: "Invalid name" });
    }
    if(!longitude || !validLongitude(longitude)) {
        return res.status(400).send({ error: "Invalid longitude" });
    }
    if(!latitude || !validLatitude(latitude)) {
        return res.status(400).send({ error: "Invalid latitude" });
    }

    let id = uuid.v4();
    
    kvfs.set(`toilets/${id}`, { name, longitude, latitude }, (error) => {
        if(error) {
            console.error("Failed to save toilet", { id, name, longitude, latitude }, error);
            return res.status(500).send({ error: "Failed to create toilet" });
        }
        kvfs.set(`toilet-posts/${id}`, [], (error) => {
            if(error) {
                console.error("Failed to create empty posts list", { id, name }, error);
                return res.status(500).send({ error: "Failed to create toilet" });
            }
            res.send({ id, name });
        });
    });
});

function validLongitude(longitude) {
    //TODO:
    return true;
}

function validLatitude(latitude) {
    //TODO: 
    return true;
}

app.get("/toilets", (req, res) => {
    let { longitude, latitude } = req.query;

    longitude = parseFloat(longitude);
    latitude = parseFloat(latitude);

    //validate query

    kvfs.list("toilets", (error, toiletIds) => {
        if(error) {
            console.error("Failed to get toilet list", error);
            return res.status(500).send({ error: "Failed to get toilet list" });
        }

        Promise.all(toiletIds.map((toiletId) => new Promise((resolve, reject) => {
            kvfs.get(toiletId, (error, toilet) => {
                if(error) {
                    return reject(error);
                }
                let id = toiletId.slice("toilets/".length);
                toilet.id = id;
                resolve(toilet);
            })
        }))).then((toilets) => {
            let results = toilets
                .map((toilet) => {
                    let distance = distanceBetween(toilet, { longitude, latitude });
                    return { id: toilet.id, name: toilet.name, distance };
                })
                .sort((a, b) => {
                    return a.distance - b.distance;
                })
                .slice(0, 10);

            res.send(results);
        });
    });
});

function distanceBetween(n1, n2) {
    let R = 6378.137;
    let aLatPi = n1.latitude * Math.PI / 180;
    let bLatPi = n2.latitude * Math.PI / 180;
    let dLat = bLatPi - aLatPi;
    let dLon = n2.longitude * Math.PI / 180 - n1.longitude * Math.PI / 180;
    let sinHalfDLat = Math.sin(dLat/2);
    let sinHalfDLon = Math.sin(dLon/2);
    let a = sinHalfDLat * sinHalfDLat + Math.cos(aLatPi) * Math.cos(bLatPi) * sinHalfDLon * sinHalfDLon;
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    let d = R * c;
    return d * 1000;
}

app.get("/toilets/:id", (req, res) => {
    let { id } = req.params;

    kvfs.get(`toilets/${id}`, (error, toilet) => {
        if(error && error.code == "ENOENT") {
            return res.status(404).send({ error: "No such toilet" });
        }
        if(error) {
            console.error("Failed to get toilet", { id }, error);
            return res.status(500).send({ error: "Failed to get toilet" });
        }
        kvfs.get(`toilet-posts/${id}`, (error, posts) => {
            if(error) {
                console.error("Failed to get posts for toilet", { id }, error);
                return res.status(500).send({ error: "Failed to get toilet" });
            }
            toilet.posts = posts;
            res.send(toilet);
        });
    });
});

module.exports = app;