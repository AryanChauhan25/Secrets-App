require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.set('view engine', 'ejs');

// Level 5 authentication - passport and express-session

app.use(session({
	secret: "Anime is my life.",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const atlas = process.env.ATLAS_ID;
mongoose.connect("mongodb+srv://atlas-levi25:" + atlas + "@todo-list.vw2ki.mongodb.net/user2DB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
	email: {
		type: String,
		unique: true,
	},
	password: String,
	googleId: String,
	facebookId: String,
	secret: [String]
});

userSchema.plugin(findOrCreate);
userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// For Google authentication
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://murmuring-refuge-74913.herokuapp.com/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

// For Facebook authentication
passport.use(new FacebookStrategy({
    clientID: process.env.FB_ID,
    clientSecret: process.env.FB_SECRET,
    callbackURL: "https://murmuring-refuge-74913.herokuapp.com/auth/facebook/secrets",
    enableProof: true
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


//--------------------------------------- Home Page ------------------------------------------

app.get("/", function(req,res) {
	res.render("home");
});


//--------------------------------------- About Page ------------------------------------------

app.get("/about", function(req,res) {
	if(req.isAuthenticated()){
		res.render("about2");
	} else {
		res.render("about");
	}
});


//--------------------------------------- Contact Page ------------------------------------------

app.get("/contact", function(req,res) {
	if(req.isAuthenticated()){
		res.render("contact2");
	} else {
		res.render("contact");
	}
});


//--------------------------------------- Google Page ------------------------------------------

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);
app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);


//--------------------------------------- Facebook Page ------------------------------------------

app.get("/auth/facebook",
  passport.authenticate("facebook")
);
app.get("/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);


//--------------------------------------- Login Page ----------------------------------------

app.route("/login")
.get(function(req,res) {
	res.render("login");
})
.post(function(req,res) {
	const newUser = new User({
		username: req.body.username,
		password: req.body.password
	});
	req.login(newUser, function(err) {
		if(err) {
			console.log(err);
			res.send("Incorrect email or password.");
		} else {
			passport.authenticate("local")(req, res, function() {
				res.redirect("/secrets");
			});
		}
	});
});


//--------------------------------------- Home Secret Page ------------------------------------------

app.get("/secrets", function(req,res) {
	if(req.isAuthenticated()){
		User.find({"secret": {$ne: null}}, function(err, foundUsers) {
			if(err) {
				console.log(err);
			} else {
				if(foundUsers) {
					res.render("usersecrets", {usersWithSecrets: foundUsers});
				} else {
					res.render("login");
				}
			}
		});
	} else {
		User.find({"secret": {$ne: null}}, function(err, foundUsers) {
			if(err) {
				console.log(err);
			} else {
				if(foundUsers) {
					res.render("secrets", {usersWithSecrets: foundUsers});
				} else {
					res.render("secrets");
				}
			}
		});
	}
});


//-------------------------------------------- Profile Page ---------------------------------------------

app.route("/profile")
.get(function(req,res) {
	User.findById(req.user.id, function(err, foundUser) {
		if(err) {
			console.log(err);
		} else {
			if(foundUser) {
				res.render("profile", {usersWithSecrets: foundUser.secret});
			} else {
				res.render("register");
			}
		}
	});
})
.post(function(req,res) {
	User.findById(req.user.id, function(err, foundUser) {
		if(err) {
			console.log(err);
		} else {
			if(foundUser) {
				User.findByIdAndUpdate(req.user.id, {$pull: { "secret": req.body.button }}, function(err) {
					if(err) {
						console.log(err);
					} else {
						res.redirect("/profile");
					}
				});
			} else {
				res.render("register");
			}
		}
	});
});


//--------------------------------------- Submit Page ------------------------------------------

app.route("/submit")
.get(function(req, res) {
	if(req.isAuthenticated()){
		res.render("submit");
	} else {
		res.redirect("/login");
	}
})
.post(function(req, res) {
	const data = req.body.secret;
	User.findById(req.user.id, function(err, foundUser) {
		if(err) {
			console.log(err);
		} else {
			if(foundUser) {
				User.findByIdAndUpdate(req.user.id, {$push: {secret: data}}, function(err) {
					if(err){
						console.log(err);
					} else {
						res.redirect("/secrets");
					}
				})
			} else {
				res.redirect("/login");
			}
		}
	});
});


//--------------------------------------- LogOut Page ------------------------------------------

app.get("/logout", function(req,res) {
	req.logout();
	res.redirect("/");
});


//--------------------------------------- Register Page ----------------------------------------

app.route("/register")
.get(function(req,res) {
	res.render("register");
})
.post(function(req,res) {
	User.register({username: req.body.username}, req.body.password, function(err, user) {
		if(err) {
			console.log(err);
			res.redirect("/register");
			// res.send(alert("Something went wrong. Please try again!"));
		} else {
			passport.authenticate("local")(req, res, function() {
				res.redirect("/secrets");
			});
		}
	});
});


app.listen(process.env.PORT || 3000, function() {
	console.log("Server is working at port 3000.");
});

