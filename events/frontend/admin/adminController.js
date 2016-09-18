(function ()
{
	'use strict';
	var baseUrl = baseUrlRepository['oms-events'];
	var apiUrl = baseUrl + 'api/';


	angular
		.module('app.eventadmin', ['ui.bootstrap.datetimepicker', 'bootstrap3-typeahead'])
		.config(config)
		.controller('DashboardController', DashboardController)
		.controller('NewController', NewController)
		.controller('ApproveParticipantsController', ApproveParticipantsController)
		.controller('ApproveEventsController', ApproveEventsController)
		.controller('OrganizersController', OrganizersController)
		.controller('ServiceAdminController', ServiceAdminController)
		.directive( "mwConfirmClick", [
			function() {
				return {
					priority: -1,
					restrict: 'A',
					scope: { confirmFunction: "&mwConfirmClick" },
					link: function( scope, element, attrs ){
					element.bind( 'click', function( e ){
						// message defaults to "Are you sure?"
						var message = attrs.mwConfirmClickMessage ? attrs.mwConfirmClickMessage : "Are you sure?";
						// confirm() requires jQuery
						if( confirm( message ) ) {
							scope.confirmFunction();
							}
						});
					}
				}
			}
		]);

	/** @ngInject */
	function config($stateProvider)	{
		// State
		 $stateProvider
			.state('app.eventadmin', {
				url: '/eventadmin',
				data: {'pageTitle': 'Event admin'},
				views   : {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/admin/dashboard.html',
						controller: 'DashboardController as vm'
					}
				}
			})
			.state('app.eventadmin.edit', {
				url: '/edit/:id',
				views: {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/admin/new.html',
						controller: 'NewController as vm'
					}
				}
			})
			.state('app.eventadmin.new', {
				url: '/new',
				views: {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/admin/new.html',
						controller: 'NewController as vm'
					}
				}
			})
			.state('app.eventadmin.approve_participants', {
				url: '/approve_participants/:id',
				views: {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/admin/approveParticipants.html',
						controller: 'ApproveParticipantsController as vm'
					}
				}
			})
			.state('app.eventadmin.approve_events', {
				url: '/approve_events',
				views: {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/admin/approveEvents.html',
						controller: 'ApproveEventsController as vm'
					}
				}
			})
			.state('app.eventadmin.organizers', {
				url: '/organizers/:id',
				views: {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/admin/organizers.html',
						controller: 'OrganizersController as vm'
					}
				}
			})
			.state('app.eventadmin.serviceadmin', {
				url: '/service-admin',
				views: {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/admin/serviceadmin.html',
						controller: 'ServiceAdminController as vm'
					}
				}
			});
	}

	function DashboardController($scope) {

	}

	function NewController($scope, $http, $stateParams, $state, $filter, $parse) {
		$scope.heading = "New Event";
		$scope.event = {starts: '', ends: ''};

		// Per default make event editable
		$scope.permissions = {
			edit_details: true,
			approve: false,
			edit_application_status: false,
			edit: true
		};
		$scope.event.application_fields = [];
		$scope.newfield = '';
		$scope.newevent = true;
		$scope.neworganizer = {}


		// Add callbacks to handle application field changes
		$scope.addApplicationField = function() {
			if($scope.newfield)
				$scope.event.application_fields.push({name: $scope.newfield});
			$scope.newfield = '';
		}
		$scope.removeApplicationField = function(index) {
			if($scope.event.application_fields && $scope.event.application_fields.length > index)
				$scope.event.application_fields.splice(index, 1);
		}

		var ticketcount = 0;
		$scope.fetchNames = function(query) {
			ticketcount = ticketcount+1;
			var myticket = ticketcount;
			$http.get('/api/getUsers?limit=10&name=' + query).success(function(res) {
				// Do ticket synchronization if one request passes the other one
				// This way we will only display the result of the last search
				if(ticketcount == myticket) {
					$scope.neworganizer.proposals = [];
					res.rows.forEach(item => {
						$scope.neworganizer.proposals.push({
							foreign_id: item.cell[0],
							name: item.cell[1],
							antenna_name: item.cell[5]
						});
					});
					console.log($scope.neworganizer.proposals);
				}
			});
		}
		$scope.addOrganizer = function(organizer) {
			$scope.event.organizers.push(organizer);
			$scope.neworganizer.query = '';
		}
		$scope.removeOrganizer = function(index) {
			if($scope.event.organizers && $scope.event.organizers.length > index)
				$scope.event.organizers.splice(index, 1);
		}

		// If no route params are given, the user wants to create a new event -> Post
		$scope.submitForm = function() {
			$http.post(apiUrl, $scope.event).success(function (response) {
				$state.go(app.events.mine);
			}).catch(function (err) {
				for(var attr in err.data.errors) {
					var serverMessage = $parse('eventForm.' + attr + '.$error.message');
					$scope.eventForm.$setValidity(attr, false, $scope.eventForm);
					serverMessage.assign($scope, err.data.errors[attr].message);
				}
			});
		}

		// Load data from server, if eventid specified
		// Also use another submit message
		if($stateParams.id) {

			$scope.newevent = false;

			// Add callbacks to delete the
			var resourceURL = apiUrl + '/single/' + $stateParams.id;
			$scope.heading = "Edit Event";
			$scope.deleteEvent = function() {
				$http.delete(resourceURL).then(function(res) {
					$state.go('app.events');
				}, function(err) {
					console.log(err);
				})
			};

			// Add callbacks to request approval
			$scope.setApproval = function(newstatus) {
				$http.put(resourceURL + '/status', {status: newstatus}).success(function(response) {
					if(newstatus == 'requesting')
						$state.go('app.events.single', {id: $stateParams.id});
					else
						$state.reload();
				});
			}

			// Edit the event with a put
			$scope.submitForm = function() {
				$http.put(resourceURL, $scope.event).success(function (response) {
					$state.reload();
				}).catch(function (err) {
					console.log(err);
					for(var attr in err.data.errors) {
						var serverMessage = $parse('eventForm.' + attr + '.$error.message');
						$scope.eventForm.$setValidity(attr, false, $scope.eventForm);
						serverMessage.assign($scope, err.data.errors[attr].message);
					}
				});
			}
			
			// Get the current event status
			$http.get(resourceURL).success( function(response) {
				$scope.event = response;
			});

			// Get organizers
			$http.get(resourceURL + '/organizers').success(function (res) {
				$scope.event.organizers = res;
			});

			// Get the rights this user has on this event
			$http.get(resourceURL + '/rights').success(function(res) {
				$scope.permissions = res.can;
			});
		}

	}

	function ApproveParticipantsController($scope, $http, $stateParams) {
		// Fetch applications to this event
		var fetchApplications = $http.get(apiUrl + 'single/' + $stateParams.id + '/participants');

		// Get the event to fetch application fields
		$http.get(apiUrl + 'single/' + $stateParams.id ).success(function(res) {
			$scope.event = res;
			fetchApplications.success(function(res) {
				console.log(res);
				$scope.event.applications = res;
			});
		});

		// Get the rights this user has on this event
		$http.get(apiUrl + 'single/' + $stateParams.id + '/rights').success(function(res) {
			$scope.permissions = res.can;
			console.log(res);
		});

		// Depending on status, return right css class
		$scope.calcColor = function(application) {
			switch(application.application_status) {
				case 'accepted':
					return 'success';
				case 'rejected':
					return 'danger';
				default:
					return 'active';
			}
		}

		$scope.showModal = function(application) {
			// Loop through application fields and assign them to our model
			application.application.forEach(function(field) {
				// Find the matching application_field to our users application field
				$scope.event.application_fields.some(function(item, index) {
					if(field.field_id == item._id) {
						$scope.event.application_fields[index].answer = field.value;
						return true;
					}
					return false;
				});
			});

			$scope.application = application;
			$('#applicationModal').modal('show');
		}

		$scope.changeState = function(application, newState) {
			// Store the change
			$http.put(apiUrl + 'single/' + $stateParams.id + '/participants/status/' + application.id, {application_status: newState}).success(function(res) {
				$scope.event.applications.some(function(item, index) {
					if(item.id == application.id) {
						$scope.event.applications[index].application_status = newState;
						return true;
					}
					return false;
				})
				$('#applicationModal').modal('hide');
			});
		}
	}

	function ApproveEventsController($scope, $http) {

		$http.get(apiUrl + 'mine/approvable').success(function(response) {
			$scope.events = response;
		});

		$scope.changeState = function(event, newstate) {
			$http.put(apiUrl + 'single/' + event.id + '/status', {status: newstate}).success(function(response) {
				$scope.events.splice($scope.events.find(item => item.id == event.id));
				if(newstate == 'approved') {
					$.gritter.add({
	                    title: 'Event approved',
	                    text: event.name + 'has been approved and is now visible on event listing',
	                    sticky: true,
	                    time: '',
	                    class_name: 'my-sticky-class'
	                });
				}
				else {
					$.gritter.add({
	                    title: 'Event reset',
	                    text: event.name + 'has been sent to draft again, the organizers will edit it',
	                    sticky: true,
	                    time: '',
	                    class_name: 'my-sticky-class'
	                });
				}
			});
		}
	}

	function OrganizersController($scope, $http, $stateParams) {
		$scope.setSearch = function(local) {
			if(local) $scope.search = {antenna_id: local.foreign_id};
			else $scope.search = {};
		}

		$http.get(apiUrl + 'single/' + $stateParams.id + '/organizers').success(function(res) {
			$scope.organizers = res;
			$scope.locals = [];
			res.forEach(organizer => {
				if(!$scope.locals.some(local => local.foreign_id == organizer.antenna_id))
					$scope.locals.push({
						foreign_id: organizer.antenna_id,
						name: organizer.antenna_name
					});
			});
		});
	}

	function ServiceAdminController($scope, $http) {
		var start1 = new Date().getTime();
		$http.get(apiUrl + 'getUser').success( function(response) {
			$scope.user = response;
			$scope.roundtrip1 = (new Date().getTime()) - start1;
		});

		var start2 = new Date().getTime();
		$http.get(apiUrl + 'status').success( function(response) {
			$scope.status = response;
			$scope.roundtrip2 = (new Date().getTime()) - start2;
		});

		$http.get('/api/getUser?id=1').success(function(res) {
			console.log(res);
		});

		$http.get('/api/getRoles').success(function(allRoles) {
			$scope.roles = [];
			allRoles.rows.forEach(item => {
				$scope.roles.push({
					id: item.cell[0],
					name: item.cell[1]
				});
			});

			$http.get(apiUrl + 'roles').success(function(setRoles) {
				if(setRoles.su_admin) {
					$scope.su_admin = $scope.roles.find(item => item.id == setRoles.su_admin);
				}
				if(setRoles.statutory_admin) {
					$scope.statutory_admin = $scope.roles.find(item => item.id == setRoles.statutory_admin);
				}
				if(setRoles.non_statutory_admin) {
					$scope.non_statutory_admin = $scope.roles.find(item => item.id == setRoles.non_statutory_admin);
				}
				if(setRoles.super_admin) {
					$scope.super_admin = $scope.roles.find(item => item.id == setRoles.super_admin);
				}
			});
		});


		$scope.submitForm = function() {
			var data = {roles: {
				su_admin: "",
				statutory_admin: "",
				non_statutory_admin: "",
				super_admin: "",
			}};

			if($scope.su_admin) data.roles.su_admin = $scope.su_admin.id;
			if($scope.statutory_admin) data.roles.statutory_admin = $scope.statutory_admin.id;
			if($scope.non_statutory_admin) data.roles.non_statutory_admin = $scope.non_statutory_admin.id;
			if($scope.super_admin) data.roles.super_admin = $scope.super_admin.id;


			$http.put(apiUrl + 'roles', data).success(function(response) {
				alert("Saved successfully");
			});
		}
	}
})();

