(function ()
{
	'use strict';
	var baseUrl = baseUrlRepository['oms-events'];
	var apiURL = baseUrl + 'api/';


	angular
		.module('app.eventadmin', [])
		.config(config)
		.controller('DashboardController', DashboardController)
		.controller('NewController', NewController)
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
			});
	}

	function DashboardController($scope) {

	}

	function NewController($scope, $http, $stateParams, $state, $filter) {

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

		// If no route params are given, the user wants to create a new event -> Post
		$scope.submitForm = function() {
			console.log($scope.event);
			$http.post(apiURL, $scope.event).then(function successCallback(response) {
				$state.go('app.events.single', {id: response.data._id});
				console.log(response);
			}, function errorCallback(response) {
				console.log(response);
			});
		}

		// Load data from server, if eventid specified
		// Also use another submit message
		if($stateParams.id) {

			var resourceURL = apiURL + '/single/' + $stateParams.id;
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
			
			$http.get(resourceURL).success( function(response) {
				$scope.event = response;
				$("#startsDateTimePicker > input").val($filter('date')(response.starts, 'MM/dd/yyyy h:mm a'));
				$("#endsDateTimePicker > input").val($filter('date')(response.ends, 'MM/dd/yyyy h:mm a'));
				$("#deadlineDateTimePicker > input").val($filter('date')(response.application_deadline, 'MM/dd/yyyy h:mm a'));
			});
		}

	}

})();

