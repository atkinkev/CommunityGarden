/* 
* Kevin Atkins
* 11/16/2019
* Cloud Development Homework 7
*/

'use strict';
//routes
const express = require('express');
const app = express();
const router = express.Router();
const login = express.Router();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
const request = require('request');
var path = require('path');

// templating
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
app.engine('handlebars', handlebars.engine); 
app.set('view engine', 'handlebars');

//validation
const Joi = require('@hapi/joi');

// API constants
const _client_id = '34671304018-s098d2mljkpaufrd6no3b9a6upspim76.apps.googleusercontent.com';
const _client_secret = '319tPZp5XYGGDYp3lTSkgM95';
const _domain_url = 'http://localhost:8080';
var state = '';
var authKey = '';
var idToken = '';

// entity specific fuctions
const p = require('./entities/patch.js');
const c = require('./entities/crop.js');
const o = require('./entities/owner.js');

// Patch and Crop definitions
const patchBody = Joi.object({
  name: Joi.string(),
  soil_type: Joi.string(),
  fertilizer_type: Joi.string(),
  last_watered: Joi.string(),
});

const cropBody = Joi.object({
  name: Joi.string(),
  description: Joi.string(),
  age: Joi.number().integer(),
  patch_id: Joi.number()
});

const patchBodyStrict = Joi.object({
  name: Joi.string().required(),
  soil_type: Joi.string().required(),
  fertilizer_type: Joi.string().required(),
  last_watered: Joi.string().required(),
});

const cropBodyStrict = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  age: Joi.number().integer().required(),
  patch_id: Joi.number().integer()
});

const validID = Joi.object({
  id: Joi.number().unsafe(),
  id_2: Joi.number().unsafe()
})

//Google lib
const {OAuth2Client} = require('google-auth-library');
const authClient = new OAuth2Client(_client_id);

// Web Client route
router.get('/', function(req, res) {
  var context = {};
  res.render('home', context);
    //res.sendFile(path.join(__dirname + '/index.html'));
});

// Validates a set of items for uniqueness against an item and a common value 
function isUnique(set, item, value){
  for (var i of set){
    // if not unique and also not the item itself, return false
    if (i[value] == item[value] && item.id != i.id){
      return false;
    }
  }
  return true;

}
/*
PATCHES
*/

//[C] Create a new patch
router.post('/patches', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  patchBodyStrict.validateAsync(req.body).then(validatedBody => {
    p.getPatches().then(patches =>{
      if (!isUnique(patches, req.body, "name")){
        res.status(403).send('{ "Error": "The patch name must be unique." }')
        return;
      }
      p.post_patch(req.body.name, req.body.soil_type, req.body.fertilizer_type, req.body.last_watered).then(key => {
        req.body["id"] = key["id"];
        req.body["self"] = req.protocol + '://' + req.get('host') + req.originalUrl + '/' + key.id;
        res.status(201).send(req.body)
      })
    })
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  }) 
});

// [R] Get all patches
router.get('/patches', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  var page = req.query.page;
  if (page == null){
    page = 0;
  }
  p.getPatches().then(patches => {
    for (const patch of patches){
      patch["self"] = req.protocol + '://' + req.get('host') + req.originalUrl + '/' + patch.id;
    }
    //paging
    var results = [];
    if (patches[5*page] != null){results.push(patches[5*page]);}
    if (patches[5*page+1] != null){results.push(patches[5*page+1]);}
    if (patches[5*page+2] != null){results.push(patches[5*page+2]);}
    if (patches[5*page+3] != null){results.push(patches[5*page+3]);}
    if (patches[5*page+4] != null){results.push(patches[5*page+4]);}
    var paging_info = {results: patches.length}
    if (5*page + 5 < patches.length){
      paging_info.next_page = req.protocol + '://' + req.get('host') +'/patches?page=' + (++page);
    }
    const allInfo = {
      patches: results,
      paging_info: paging_info
    }
    res.status(200).send(allInfo);
  })
});

// [R] Get a specific patch
router.get('/patches/:patch_id', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  validID.validateAsync({id: req.params.patch_id}).then(validatedID => {
    p.getPatch(req.params.patch_id).then(patch => {
      if(patch[0]){
        patch[0]["id"] = req.params.patch_id;
        patch[0]["self"] = req.protocol + '://' + req.get('host') + req.originalUrl
        res.status(200).send(patch[0]);
      }
      else{
        res.status(404).send('{ "Error": "The requested patch does not exist." }')
      }
    })
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  })
});

// [U] Update an entire patch
router.put('/patches/:patch_id', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  patchBodyStrict.validateAsync(req.body).then(goodBody => {
    p.getPatch(req.params.patch_id).then(patch => {
      if (patch[0] == null) {
        res.status(404).send('{ "Error": "No patch with that patch_id found." }')
        return;
      }
      else{
        p.getPatches().then(patches =>{
          req.body.id = req.params.patch_id;
          if (req.body.name && !isUnique(patches, req.body, "name")){
            res.status(403).send('{ "Error": "The patch name must be unique." }')
            return;
          }
          p.updateEntirePatch(req.params.patch_id, req.body.name, req.body.soil_type, req.body.fertilizer_type, req.body.last_watered).then(newPatch => {
            req.body["id"] = newPatch["id"];
            req.body["self"] = req.protocol + '://' + req.get('host') + req.originalUrl
            res.status(200).send(req.body);
            return;
          })
        })
      }
    })  
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  })
});

// [U] Update a partial patch. Yep, we're patching patches.
router.patch('/patches/:patch_id', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  patchBody.validateAsync(req.body).then(verifiedBody => {
    p.getPatch(req.params.patch_id).then(patch => {
      if (patch[0] == null) {
        res.status(404).send('{ "Error": "No patch with that patch_id found." }')
        return;
      }
      else{
        p.getPatches().then(patches =>{
          req.body.id = req.params.patch_id;
          if (req.body.name && !isUnique(patches, req.body, "name")){
            res.status(403).send('{ "Error": "The patch name must be unique." }')
            return;
          }
          // if param not passed, just update it with itself
          if (req.body.name == null){ req.body.name = patch[0]["name"]; }
          if (req.body.soil_type == null){ req.body.soil_type = patch[0]["soil_type"]; }
          if (req.body.fertilizer_type == null){ req.body.fertilizer_type = patch[0]["fertilizer_type"]; }
          if (req.body.last_watered == null){ req.body.last_watered = patch[0]["last_watered"]; }
          p.updateEntirePatch(req.params.patch_id, req.body.name, req.body.soil_type, req.body.fertilizer_type, req.body.last_watered).then(newPatch => {
            req.body["id"] = newPatch["id"];
            req.body["self"] = req.protocol + '://' + req.get('host') + req.originalUrl
            res.status(200).send(req.body);
            return;
          })
        })
      }
    })
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  })
});

// [D] Delete a patch
router.delete('/patches/:patch_id', function(req, res){
  p.getPatch(req.params.patch_id).then(patch => {
    if (patch[0] == null) {
      res.status(404).send('{ "Error": "No patch with that patch_id found." }')
      return;
    }
    else{
      // cleanup crop patch_id
      if(patch[0].crops){
        for (var crop of patch[0].crops){
          crop.patch_id = null;
          c.updateEntireCrop(crop.id, crop).then(updatedCrop => {
            o.getOwners().then(owners => {
              for (var owner of owners){
                for (var iCrop of owner.crops){
                  if (iCrop.patch_id == req.params.patch_id){
                    iCrop.patch_id = null;
                    o.updateOwnersCrops(owner.id, owner, iCrop.id, iCrop, false)
                    return;
                  }
                }
              }
            })
          })
        }
        p.deletePatch(req.params.patch_id).then(key => {
          res.status(204).end();
          return;
        })
      }
      else{
        p.deletePatch(req.params.patch_id).then(key => {
          res.status(204).end();
          return;
        })
      }
    }
  })
});

/*
CROPS
*/

// [C] Create a new crop attached to an owner in a patch
router.post('/crops', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  var thisOwner = null;
  if(!req.headers.authorization){
    res.status(401).send('{ "Error": "Missing Authorization" }');
    return;
  }
  cropBodyStrict.validateAsync(req.body).then(validBody =>{
    if (req.headers.authorization.split(' ').length > 1){
      verify(req.headers.authorization.split(' ')[1]).then(userInfo => {
        req.body.owner = userInfo;
        c.post_crop(req.body).then(key => {
          req.body["id"] = key["id"];
          req.body["self"] = req.protocol + '://' + req.get('host') + req.originalUrl + '/' + key.id;
          req.body.owner = userInfo;
          o.getOwners().then(owners => {
            for (var owner of owners){
              if (owner["owner_id"] == userInfo["userid"]){
                thisOwner = owner;
              }
            }
            // if owner exists, append crop to their crops
            if(thisOwner){
              var ownersCollection = [];
              for(var crop of thisOwner["crops"]){
                ownersCollection.push(crop);
              }
              ownersCollection.push(req.body);
              o.updateOwner(thisOwner["id"], userInfo["email"], userInfo["userid"], ownersCollection);
            }
            // create a new owner
            else{
              o.post_owner(userInfo["email"], userInfo["userid"], [req.body]);
            }
            res.status(201).send(req.body)
          })
        })
      })
      .catch(error => {
        res.status(401).send('{ "Error": "Invalid Authorization" }');
      })
    }
    else {
      res.status(401).send('{ "Error": "Invalid Authorization" }');
    }
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  }) 
});

// [R] Get Sepcific crop
router.get('/crops/:crop_id', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  validID.validateAsync({id: req.params.crop_id}).then(validID => {
    c.getCrop(req.params.crop_id).then(crop => {
      if(crop[0]){
        crop[0]["id"] = req.params.crop_id;
        crop[0]["self"] = req.protocol + '://' + req.get('host') + req.originalUrl
        res.status(200).send(crop[0]);
      }
      else{
        res.status(404).send('{ "Error": "The requested crop does not exist." }')
      }
    })
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  }) 
});

// [R] Get all crops
router.get('/crops', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  var page = req.query.page;
  if (page == null){
    page = 0;
  }
  c.getCrops().then(crops => {
    for (const crop of crops){
      crop["self"] = req.protocol + '://' + req.get('host') + req.originalUrl + '/' + crop.id;
    }
    var results = [];
    if (crops[5*page] != null){results.push(crops[5*page]);}
    if (crops[5*page+1] != null){results.push(crops[5*page+1]);}
    if (crops[5*page+2] != null){results.push(crops[5*page+2]);}
    if (crops[5*page+3] != null){results.push(crops[5*page+3]);}
    if (crops[5*page+4] != null){results.push(crops[5*page+4]);}
    var paging_info = {results: crops.length}
    if (5*page + 5 < crops.length){
      paging_info.next_page = req.protocol + '://' + req.get('host') +'/crops?page=' + (++page);
    }
    const allInfo = {
      crops: results,
      paging_info: paging_info
    }
    res.status(200).send(allInfo);
  })
});

// [U] Update a partial crop. Requires user to own crop
router.patch('/crops/:crop_id', function(req, res){
  if(!checkAccepts(req, res)){
    return;
  }
  if(!req.headers.authorization){
    res.status(401).send('{ "Error": "Missing Authorization" }');
  }
  cropBody.validateAsync(req.body).then(verifiedBody => {  
    var validOwner = false;
    if (req.headers.authorization.split(' ').length > 1){
      verify(req.headers.authorization.split(' ')[1]).then(userInfo => {
        o.getOwners().then(owners =>{
          // this owner
          for (var owner of owners){
            if (owner.owner_id == userInfo.userid){
              // this owners crops
              for (var crop of owner["crops"]){
                // if this owner owns this crop
                if (crop.id == req.params.crop_id){
                  validOwner = true;
                  c.getCrop(req.params.crop_id).then(crop => {
                    req.body.patch_id = crop[0].patch_id;
                    if (req.body.name == null){ req.body.name = crop[0]["name"]; }
                    if (req.body.description == null){ req.body.description = crop[0]["description"]; }
                    if (req.body.age == null){ req.body.age = crop[0]["age"]; }
                    c.updateEntireCrop(req.params.crop_id, req.body.name, req.body.description, req.body.age, req.body.patch_id).then(newCrop => {
                      req.body["id"] = newCrop["id"];
                      req.body["self"] = req.protocol + '://' + req.get('host') + req.originalUrl;
                      res.status(200).send(req.body);
                      return;
                    })
                  })
                }
              }
            }
          }
          if(!validOwner){
            res.status(401).send('{ "Error": "Invalid owner or crop." }');
          }
        })
      })
      .catch(error => {
        res.status(401).send('{ "Error": "Invalid credentials." }');
      })
    }
    else{
      res.status(401).send('{ "Error": "Invalid credentials." }');
    }
  })
});

// [U] Update an entire crop. Requires user to own crop
router.put('/crops/:crop_id', function(req, res){
  if(!req.headers.authorization){
    res.status(401).send('{ "Error": "Missing Authorization" }');
  }
  var validOwner = false;
  cropBodyStrict.validateAsync(req.body).then(validatedCrop => {
    if (req.headers.authorization.split(' ').length > 1){
      verify(req.headers.authorization.split(' ')[1]).then(userInfo => {
        o.getOwners().then(owners =>{
          // this owner
          for (var owner of owners){
            if (owner.owner_id == userInfo.userid){
              // this owners crops
              for (var crop of owner["crops"]){
                // if this owner owns this crop
                if (crop.id == req.params.crop_id){
                  validOwner = true;
                  c.getCrop(req.params.crop_id).then(crop => {
                    req.body.patch_id = crop.patch_id;
                    c.updateEntireCrop(req.params.crop_id, req.body.name, req.body.description, req.body.age, req.body.patch_id).then(newCrop => {
                      req.body["id"] = newCrop["id"];
                      req.body["self"] = req.protocol + '://' + req.get('host') + req.originalUrl;
                      res.status(200).send(req.body);
                      return;
                    })
                  })
                }
              }
            }
          }
          if(!validOwner){
            res.status(401).send('{ "Error": "You either don\'t have the authorization to access this crop or it does not exist." }');
          }
        })
      })
      .catch(error => {
        res.status(401).send('{ "Error": "Invalid credentials." }');
      })
    }
    else{
      res.status(401).send('{ "Error": "Invalid credentials." }');
    }
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  }) 
});

// [D] Delete a crop
router.delete('/crops/:crop_id', function(req, res){
  if(!req.headers.authorization){
    res.status(401).send('{ "Error": "Missing Authorization" }');
    return;
  }
  var validOwner = false;
  if (req.headers.authorization.split(' ').length > 1){
    verify(req.headers.authorization.split(' ')[1])
    .then(userInfo => {
      o.getOwners().then(owners =>{
        for (var owner of owners){
          // this owner
          if (owner.owner_id == userInfo.userid){
            for (var crop of owner["crops"]){
              // this crop
              if (crop.id == req.params.crop_id){
                validOwner = true;
                if(crop.patch_id){
                  // remove from existing patch
                  p.getPatch(crop.patch_id).then(existingPatch => {
                    if (existingPatch[0]){
                      c.removeCropFromPatch(crop.patch_id, req.params.crop_id, existingPatch[0]).then(clearedPatch => {
                        o.updateOwnersCrops(owner.id, owner, req.params.crop_id, crop, true).then(done => {
                          c.deleteCrop(crop["id"]).then(res.status(204).end());
                        })
                      })
                    }
                    // remove from existing owner when patch id doesn't exist (strange edge case)
                    else{
                      o.updateOwnersCrops(owner.id, owner, req.params.crop_id, crop, true).then(done => {
                        c.deleteCrop(crop["id"]).then(res.status(204).end());
                      })
                    }
                  })
                }
                // remove from existing owner
                else{
                  o.updateOwnersCrops(owner.id, owner, req.params.crop_id, crop, true).then(done => {
                    c.deleteCrop(crop["id"]).then(res.status(204).end());
                  })
                }
              }
            }
          }
        }
        if(!validOwner){
          res.status(401).send('{ "Error": "Invalid owner or crop." }');
        }
      })
    })
    .catch(error => {
      res.status(401).send('{ "Error": "Invalid credentials." }');
    })
  }
  else{
    res.status(401).send('{ "Error": "Invalid credentials." }');
  }
});

router.get('/owners', function(req, res){
  o.getOwners().then(owners => {
    for (const owner of owners){
      owner.self = req.protocol + '://' + req.get('host') + req.originalUrl + '/' + owner.id;
    }
    res.status(200).send(owners);
  })
});

/*
CROP-PATCH RELATIONSHIPS
*/

// Add a crop to a patch
router.put('/patches/:patch_id/crops/:crop_id', function(req, res){
  if(!req.headers.authorization){
    res.status(401).send('{ "Error": "Missing Authorization" }');
  }
  var validOwner = false;
  validID.validateAsync({id: req.params.patch_id, id_2: req.params.crop_id}).then(validatedId => {
    if (req.headers.authorization.split(' ').length > 1){
      verify(req.headers.authorization.split(' ')[1]).then(userInfo => {
        o.getOwners().then(owners =>{
          for (var owner of owners){
            // this owner
            if (owner.owner_id == userInfo.userid){
              for (var _crop of owner["crops"]){
                if (_crop.id == req.params.crop_id){
                  validOwner = true;
                  // user authenticated
                  p.getPatch(req.params.patch_id).then(patch => {
                    if (!patch[0]){
                      res.status(404).send('{ "Error": "No patch exists with this patch_id." }');
                      return;
                    }
                    c.getCrop(req.params.crop_id).then(crop => {
                        if (!crop[0]){
                          res.status(404).send('{ "Error": "No crop exists with this crop_id." }');
                          return;
                        }
                        // if attempting to add crop to existing patch, say okey dokey
                        else if (crop[0].patch_id == req.params.patch_id){
                          res.set('Location',req.protocol + '://' + req.get('host') + '/patches/' + req.params.patch_id);
                          res.set('Content-Length', 0);
                          res.status(303).send();
                          return;
                        }
                        for (var item of patch[0].crops){
                          if (item.id == req.params.crop_id){
                            res.status(401).send('{ "Error": "This crop is already planted in this patch." }');
                            return;
                          }
                        }
                        // crop is in a patch and needs to be updated
                        if (crop[0].patch_id){
                          // get the old patch and remove this crop from it
                          p.getPatch(crop[0].patch_id).then(oldPatch => {
                            c.removeCropFromPatch(crop[0].patch_id, req.params.crop_id, oldPatch[0]).then(clearedPatch => {
                              // add this crop to new patch
                              crop[0].id = req.params.crop_id;
                              crop[0].patch_id = req.params.patch_id;
                              c.addCropToPatch(req.params.patch_id, patch[0], crop[0]).then(newPatch => {
                                c.updateEntireCrop(req.params.crop_id, crop[0]).then(newCrop => {
                                  o.updateOwnersCrops(owner.id, owner, req.params.crop_id, crop[0], false).then(done => {
                                    res.set('Location', req.protocol + '://' + req.get('host') + '/patches/' + req.params.patch_id);
                                    res.set('Content-Length', 0);
                                    res.status(303).send();
                                    return;
                                  })
                                })
                              })
                            })
                          })
                        }
                        else{
                          // crop is not currently in a patch and is initially added
                          crop[0].id = req.params.crop_id;
                          crop[0].patch_id = req.params.patch_id;
                          c.addCropToPatch(req.params.patch_id, patch[0], crop[0]).then(newPatch => {
                            c.updateEntireCrop(req.params.crop_id, crop[0]).then(newCrop => {
                              o.updateOwnersCrops(owner.id, owner, req.params.crop_id, crop[0], false).then(done => {
                                res.set('Location',req.protocol + '://' + req.get('host') + '/patches/' + req.params.patch_id);
                                res.set('Content-Length', 0);
                                res.status(303).send();
                                return;
                              })
                            })
                          })
                        }
                    })
                  })
                }
              }
            }
          }
          if(!validOwner){
            res.status(401).send('{ "Error": "This crop doesn\'t exist or the owner doesn\'t have permissions to edit it." }');
          }
        })
      })
    }
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  }) 
});

// Remove a crop from a patch
router.delete('/patches/:patch_id/crops/:crop_id', function(req, res){
  if(!req.headers.authorization){
    res.status(401).send('{ "Error": "Missing Authorization" }');
  }
  var validOwner = false;
  if (req.headers.authorization.split(' ').length > 1){
    verify(req.headers.authorization.split(' ')[1]).then(userInfo => {
      o.getOwners().then(owners =>{
        for (var owner of owners){
          // this owner
          if (owner.owner_id == userInfo.userid){
            for (var _crop of owner["crops"]){
              if (_crop.id == req.params.crop_id){
                validOwner = true;
                p.getPatch(req.params.patch_id).then(patch => {
                  if (!patch[0]){
                    res.status(404).send('{ "Error": "No patch exists with this patch_id." }');
                    return;
                  }
                  c.getCrop(req.params.crop_id).then(crop => {
                    if (crop[0].patch_id != req.params.patch_id){
                      res.status(401).send('{ "Error": "This crop isn\'t currently planted in this patch." }');
                      return;
                    }
                    else{
                      c.removeCropFromPatch(crop[0].patch_id, req.params.crop_id, patch[0]).then(clearedPatch => {
                        res.status(201).end();
                        return;
                      })
                    }
                  })
                })
              }
            }
          }
        }
        if(!validOwner){
          res.status(403).send('{ "Error": "Invalid owner or crop." }');
        }
      })
    })
  }
});

/*
OWNER CROP RELATIONSHIPS  
*/

// Get specific owners crops
router.get('/users/:user_id/crops', function(req, res){
  var validOwner = false;
  validID.validateAsync({id: req.params.user_id}).then(validatedID => {
    if(!req.headers.authorization){
      res.status(401).send('{ "Error": "Missing Authorization" }');
    }
    else{
      if (req.headers.authorization.split(' ').length > 1){
        verify(req.headers.authorization.split(' ')[1]).then(userInfo => {
          o.getOwners().then(owners =>{
            for (var owner of owners){
              if (owner["owner_id"] == userInfo["userid"]){
                validOwner = true;
                res.status(200).send(owner["crops"]);
                break;
              }
            }
            if(!validOwner){
              res.status(401).send('{ "Error": "Invalid owner." }');
            }
          })
        })
        .catch(error => {
          res.status(401).send('{ "Error": "Invalid credentials." }');
        })
      }
      else{
        res.status(401).send('{ "Error": "Invalid credentials." }');
      }
    }
  })
  .catch(validationError => {
    const errorMessage = validationError.details.map(d => d.message);
    res.status(400).send('{ "Error(s)": " ' + errorMessage + ' " }');
  }) 
});


/* Begin Auth Stuff */

function getRandomState(){
  var randState = '';
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  for(var i = 0; i < 10; i++){
    randState += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return randState;
}

router.get('/auth', function(req, res) {
  // Create random state to verify
  state = getRandomState();
  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=' + _client_id + '&redirect_uri=' + _domain_url + '/oauth&scope=email openid&state=' + state);
});

router.get('/oauth', function(req, res) {
    if(req.query.state != state){
      res.status(403).send('Authorization Failed!');
    }
    else{
      request.post('https://www.googleapis.com/oauth2/v4/token', {
        json: {
          code: req.query.code,
          client_id: _client_id,
          client_secret: _client_secret,
          redirect_uri: _domain_url + '/oauth',
          grant_type: 'authorization_code'
        }
      }, (error, response, body) => {
        if (error) {
          console.log(error);
          res.status(500).end();
          return;
        }
        idToken = body["id_token"];
        authKey = body["access_token"];
        res.redirect('/userInfo');
      })
    }
});

router.get('/userInfo', function(req, res){
    const context = {
      jwt: idToken,
      page_explanation: 'This page is used for a school project to use the google OAuth2 API JWT. After authenticating the user it displays a unique JWT to authorize content from our APIs.'
    }
    verify(idToken).catch(console.error);
    res.render('userPage', context);
});

async function verify(_idToken) {
  const ticket = await authClient.verifyIdToken({
      idToken: _idToken,
      audience: _client_id, 
  });
  const payload = ticket.getPayload();
  return {userid: payload['sub'], email: payload['email']};
}

/**** UNSUPPORTED ****/
const notSupportedMessage = 
{
  "Error": "Unable to delete all instances of an object."
};

router.delete('/patches', function(req, res){
  res.status(405).send(notSupportedMessage);
});

router.delete('/crops', function(req, res){
  res.status(405).send(notSupportedMessage);
});

router.delete('/users', function(req, res){
  res.status(405).send(notSupportedMessage);
});

/**** DANGER ZONE ****/
function deleteALLOWNERS(){
  o.getOwners().then(owners => {
    for (var owner of owners){
      o.deleteOwner(owner["id"]);
    }
  })
}
function deleteALLpatches(){
  p.getPatches().then(patches => {
    for (var patch of patches){
      p.deletePatch(patch["id"]);
    }
  })
}
function deleteALLcrops(){
  c.getCrops().then(crops => {
    for (var crop of crops){
      c.deleteCrop(crop["id"]);
    }
  })
}

router.delete('/theworld', function(req, res){
  deleteALLOWNERS();
  deleteALLpatches();
  deleteALLcrops();
  res.status(200).end();
});

function checkAccepts(req, res){
  const accepts = req.accepts(['application/json', 'text/html']);
  if(!accepts){
    res.status(406).send('{\n"Error": "Unable to support requested type. " \n }');
  }
  return accepts;
}


/**** App Launching Business ****/

// let router handle top level index
app.use('/', router);
app.use('/login', login);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
