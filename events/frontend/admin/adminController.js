(function ()
{
	'use strict';
	var baseUrl = baseUrlRepository['oms-events'];
	var apiUrl = baseUrl + 'api/';


	angular
		.module('app.eventadmin', [])
		.config(config)
		.controller('DashboardController', DashboardController)
		.controller('NewController', NewController)
		.controller('ApproveParticipantsController', ApproveParticipantsController)
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
						templateUrl: baseUrl + 'frontend/admin/ApproveParticipants.html',
						controller: 'ApproveParticipantsController as vm'
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

	function NewController($scope, $http, $stateParams, $state, $filter) {
		// Activate the datetimepickers and bind callbackfunctions to extract the selected date
		angular.element(document).ready(function () {
			$('#startsDateTimePicker').datetimepicker();
			$("#startsDateTimePicker").on("dp.change", function() {$scope.event.starts = $("#startsDateTimePicker > input").val();});

			$('#endsDateTimePicker').datetimepicker();
			$("#endsDateTimePicker").on("dp.change", function() {$scope.event.ends = $("#endsDateTimePicker > input").val();});

			$('#deadlineDateTimePicker').datetimepicker();
			$("#deadlineDateTimePicker").on("dp.change", function() {$scope.event.application_deadline = $("#deadlineDateTimePicker > input").val();});

			
		});

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


		// If no route params are given, the user wants to create a new event -> Post
		$scope.submitForm = function() {
			$http.post(apiUrl, $scope.event).then(function successCallback(response) {
				$state.go('app.events.single', {id: response.data._id});
				console.log(response);
			}, function errorCallback(response) {
				console.log(response);
			});
		}

		// Load data from server, if eventid specified
		// Also use another submit message
		if($stateParams.id) {

			var resourceURL = apiUrl + '/single/' + $stateParams.id;
			$scope.heading = "Edit Event";
			$scope.deleteEvent = function() {
				$http.delete(resourceURL).then(function(res) {
					$state.go('app.events');
				}, function(err) {
					console.log(err);
				})
			};

			// Edit the event with a put
			$scope.submitForm = function() {
				$http.put(resourceURL, $scope.event).then(function successCallback(response) {
					$state.go('app.events.single', {id: $stateParams.id});
				}, function errorCallback(err) {
					console.log(err);

				});
			}
			
			// Get the current event status
			$http.get(resourceURL).success( function(response) {
				$scope.event = response;
				$("#startsDateTimePicker > input").val($filter('date')(response.starts, 'MM/dd/yyyy h:mm a'));
				$("#endsDateTimePicker > input").val($filter('date')(response.ends, 'MM/dd/yyyy h:mm a'));
				$("#deadlineDateTimePicker > input").val($filter('date')(response.application_deadline, 'MM/dd/yyyy h:mm a'));
			});

			// Get the rights this user has on this event
			$http.get(apiUrl + 'single/' + $stateParams.id + '/rights').success(function(res) {
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
		});

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

	function ServiceAdminController($scope, $http) {
		var start1 = new Date().getTime();
		$http.get(apiUrl + 'getUser').success( function(response) {
			console.log(response);
			$scope.user = response;
			$scope.roundtrip1 = (new Date().getTime()) - start1;
		});

		var start2 = new Date().getTime();
		$http.get(apiUrl + 'status').success( function(response) {
			$scope.status = response;
			$scope.roundtrip2 = (new Date().getTime()) - start2;
		});
	}

})();

