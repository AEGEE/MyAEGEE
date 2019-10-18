-- PHP ARTISAN MIGRATION

-- MySQL dump 10.13  Distrib 8.0.16, for osx10.14 (x86_64)
--
-- Host: status.staging.barnab.eu    Database: cachet
-- ------------------------------------------------------
-- Server version    5.5.5-10.4.5-MariaDB-1:10.4.5+maria~bionic

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
 SET NAMES utf8mb4 ;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `actions`
--

DROP TABLE IF EXISTS `actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `actions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `class_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `information` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `actions_user_id_index` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `actions`
--

LOCK TABLES `actions` WRITE;
/*!40000 ALTER TABLE `actions` DISABLE KEYS */;
/*!40000 ALTER TABLE `actions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `cache` (
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int(11) NOT NULL,
  UNIQUE KEY `cache_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `component_groups`
--

DROP TABLE IF EXISTS `component_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `component_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order` int(11) NOT NULL DEFAULT 0,
  `visible` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `collapsed` int(10) unsigned NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `component_groups_order_index` (`order`),
  KEY `component_groups_visible_index` (`visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `component_groups`
--

LOCK TABLES `component_groups` WRITE;
/*!40000 ALTER TABLE `component_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `component_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `components`
--

DROP TABLE IF EXISTS `components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `components` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` int(11) NOT NULL,
  `order` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `meta` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `components_group_id_index` (`group_id`),
  KEY `components_status_index` (`status`),
  KEY `components_order_index` (`order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `components`
--

LOCK TABLES `components` WRITE;
/*!40000 ALTER TABLE `components` DISABLE KEYS */;
/*!40000 ALTER TABLE `components` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `failed_jobs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `connection` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incident_components`
--

DROP TABLE IF EXISTS `incident_components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `incident_components` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `incident_id` int(10) unsigned NOT NULL,
  `component_id` int(10) unsigned NOT NULL,
  `status_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `incident_components_incident_id_index` (`incident_id`),
  KEY `incident_components_component_id_index` (`component_id`),
  KEY `incident_components_status_id_index` (`status_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incident_components`
--

LOCK TABLES `incident_components` WRITE;
/*!40000 ALTER TABLE `incident_components` DISABLE KEYS */;
/*!40000 ALTER TABLE `incident_components` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incident_templates`
--

DROP TABLE IF EXISTS `incident_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `incident_templates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incident_templates`
--

LOCK TABLES `incident_templates` WRITE;
/*!40000 ALTER TABLE `incident_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `incident_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incident_updates`
--

DROP TABLE IF EXISTS `incident_updates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `incident_updates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `incident_id` int(10) unsigned NOT NULL,
  `status` int(11) NOT NULL,
  `message` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `incident_updates_incident_id_index` (`incident_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incident_updates`
--

LOCK TABLES `incident_updates` WRITE;
/*!40000 ALTER TABLE `incident_updates` DISABLE KEYS */;
/*!40000 ALTER TABLE `incident_updates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incidents`
--

DROP TABLE IF EXISTS `incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `incidents` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `component_id` int(11) NOT NULL DEFAULT 0,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` int(11) NOT NULL,
  `visible` tinyint(1) NOT NULL DEFAULT 1,
  `stickied` tinyint(1) NOT NULL DEFAULT 0,
  `notifications` tinyint(1) NOT NULL DEFAULT 0,
  `message` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `occurred_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `incidents_component_id_index` (`component_id`),
  KEY `incidents_status_index` (`status`),
  KEY `incidents_visible_index` (`visible`),
  KEY `incidents_stickied_index` (`stickied`),
  KEY `incidents_user_id_index` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incidents`
--

LOCK TABLES `incidents` WRITE;
/*!40000 ALTER TABLE `incidents` DISABLE KEYS */;
/*!40000 ALTER TABLE `incidents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invites`
--

DROP TABLE IF EXISTS `invites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `invites` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `claimed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invites_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invites`
--

LOCK TABLES `invites` WRITE;
/*!40000 ALTER TABLE `invites` DISABLE KEYS */;
/*!40000 ALTER TABLE `invites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meta`
--

DROP TABLE IF EXISTS `meta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `meta` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `meta_id` int(10) unsigned NOT NULL,
  `meta_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `meta_meta_id_meta_type_index` (`meta_id`,`meta_type`),
  KEY `meta_key_index` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meta`
--

LOCK TABLES `meta` WRITE;
/*!40000 ALTER TABLE `meta` DISABLE KEYS */;
/*!40000 ALTER TABLE `meta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `metric_points`
--

DROP TABLE IF EXISTS `metric_points`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `metric_points` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `metric_id` int(11) NOT NULL,
  `value` decimal(15,3) NOT NULL,
  `counter` int(10) unsigned NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `metric_points_metric_id_index` (`metric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `metric_points`
--

LOCK TABLES `metric_points` WRITE;
/*!40000 ALTER TABLE `metric_points` DISABLE KEYS */;
/*!40000 ALTER TABLE `metric_points` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `metrics`
--

DROP TABLE IF EXISTS `metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `metrics` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `suffix` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_value` decimal(10,3) NOT NULL,
  `calc_type` tinyint(4) NOT NULL,
  `display_chart` tinyint(1) NOT NULL DEFAULT 1,
  `places` int(10) unsigned NOT NULL DEFAULT 2,
  `default_view` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `threshold` int(10) unsigned NOT NULL DEFAULT 5,
  `order` tinyint(4) NOT NULL DEFAULT 0,
  `visible` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `metrics_display_chart_index` (`display_chart`),
  KEY `metrics_visible_index` (`visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `metrics`
--

LOCK TABLES `metrics` WRITE;
/*!40000 ALTER TABLE `metrics` DISABLE KEYS */;
/*!40000 ALTER TABLE `metrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'2015_01_05_201324_CreateComponentGroupsTable',1),(2,'2015_01_05_201444_CreateComponentsTable',1),(3,'2015_01_05_202446_CreateIncidentTemplatesTable',1),(4,'2015_01_05_202609_CreateIncidentsTable',1),(5,'2015_01_05_202730_CreateMetricPointsTable',1),(6,'2015_01_05_202826_CreateMetricsTable',1),(7,'2015_01_05_203014_CreateSettingsTable',1),(8,'2015_01_05_203235_CreateSubscribersTable',1),(9,'2015_01_05_203341_CreateUsersTable',1),(10,'2015_01_09_083419_AlterTableUsersAdd2FA',1),(11,'2015_01_16_083825_CreateTagsTable',1),(12,'2015_01_16_084030_CreateComponentTagTable',1),(13,'2015_02_28_214642_UpdateIncidentsAddScheduledAt',1),(14,'2015_05_19_214534_AlterTableComponentGroupsAddOrder',1),(15,'2015_05_20_073041_AlterTableIncidentsAddVisibileColumn',1),(16,'2015_05_24_210939_create_jobs_table',1),(17,'2015_05_24_210948_create_failed_jobs_table',1),(18,'2015_06_10_122216_AlterTableComponentsDropUserIdColumn',1),(19,'2015_06_10_122229_AlterTableIncidentsDropUserIdColumn',1),(20,'2015_08_02_120436_AlterTableSubscribersRemoveDeletedAt',1),(21,'2015_08_13_214123_AlterTableMetricsAddDecimalPlacesColumn',1),(22,'2015_10_31_211944_CreateInvitesTable',1),(23,'2015_11_03_211049_AlterTableComponentsAddEnabledColumn',1),(24,'2015_12_26_162258_AlterTableMetricsAddDefaultViewColumn',1),(25,'2016_01_09_141852_CreateSubscriptionsTable',1),(26,'2016_01_29_154937_AlterTableComponentGroupsAddCollapsedColumn',1),(27,'2016_02_18_085210_AlterTableMetricPointsChangeValueColumn',1),(28,'2016_03_01_174858_AlterTableMetricPointsAddCounterColumn',1),(29,'2016_03_08_125729_CreateIncidentUpdatesTable',1),(30,'2016_03_10_144613_AlterTableComponentGroupsMakeColumnInteger',1),(31,'2016_04_05_142933_create_sessions_table',1),(32,'2016_04_29_061916_AlterTableSubscribersAddGlobalColumn',1),(33,'2016_06_02_075012_AlterTableMetricsAddOrderColumn',1),(34,'2016_06_05_091615_create_cache_table',1),(35,'2016_07_25_052444_AlterTableComponentGroupsAddVisibleColumn',1),(36,'2016_08_23_114610_AlterTableUsersAddWelcomedColumn',1),(37,'2016_09_04_100000_AlterTableIncidentsAddStickiedColumn',1),(38,'2016_10_24_183415_AlterTableIncidentsAddOccurredAtColumn',1),(39,'2016_10_30_174400_CreateSchedulesTable',1),(40,'2016_10_30_174410_CreateScheduleComponentsTable',1),(41,'2016_10_30_182324_AlterTableIncidentsRemoveScheduledColumns',1),(42,'2016_12_04_163502_AlterTableMetricsAddVisibleColumn',1),(43,'2016_12_05_185045_AlterTableComponentsAddMetaColumn',1),(44,'2016_12_29_124643_AlterTableSubscribersAddPhoneNumberSlackColumns',1),(45,'2016_12_29_155956_AlterTableComponentsMakeLinkNullable',1),(46,'2017_01_03_143916_create_notifications_table',1),(47,'2017_02_03_222218_CreateActionsTable',1),(48,'2017_06_13_181049_CreateMetaTable',1),(49,'2017_07_18_214718_CreateIncidentComponents',1),(50,'2017_09_14_180434_AlterIncidentsAddUserId',1),(51,'2018_04_02_163328_CreateTaggablesTable',1),(52,'2018_04_02_163658_MigrateComponentTagTable',1),(53,'2018_06_14_201440_AlterSchedulesSoftDeletes',1),(54,'2018_06_17_182507_AlterIncidentsAddNotifications',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `notifications` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notifiable_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notifiable_id` bigint(20) unsigned NOT NULL,
  `data` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_notifiable_type_notifiable_id_index` (`notifiable_type`,`notifiable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule_components`
--

DROP TABLE IF EXISTS `schedule_components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `schedule_components` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `schedule_id` int(10) unsigned NOT NULL,
  `component_id` int(10) unsigned NOT NULL,
  `component_status` tinyint(3) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_components`
--

LOCK TABLES `schedule_components` WRITE;
/*!40000 ALTER TABLE `schedule_components` DISABLE KEYS */;
/*!40000 ALTER TABLE `schedule_components` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedules`
--

DROP TABLE IF EXISTS `schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `schedules` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `scheduled_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedules`
--

LOCK TABLES `schedules` WRITE;
/*!40000 ALTER TABLE `schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `sessions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int(11) NOT NULL,
  UNIQUE KEY `sessions_id_unique` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `settings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscribers`
--

DROP TABLE IF EXISTS `subscribers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `subscribers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verify_code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `slack_webhook_url` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `global` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscribers_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscribers`
--

LOCK TABLES `subscribers` WRITE;
/*!40000 ALTER TABLE `subscribers` DISABLE KEYS */;
/*!40000 ALTER TABLE `subscribers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `subscriptions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `subscriber_id` int(10) unsigned NOT NULL,
  `component_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `subscriptions_subscriber_id_index` (`subscriber_id`),
  KEY `subscriptions_component_id_index` (`component_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `taggables`
--

DROP TABLE IF EXISTS `taggables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `taggables` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tag_id` int(10) unsigned NOT NULL,
  `taggable_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `taggable_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `taggables_taggable_type_taggable_id_index` (`taggable_type`,`taggable_id`),
  KEY `taggables_tag_id_index` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `taggables`
--

LOCK TABLES `taggables` WRITE;
/*!40000 ALTER TABLE `taggables` DISABLE KEYS */;
/*!40000 ALTER TABLE `taggables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `tags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tags_name_slug_unique` (`name`,`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tags`
--

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_2fa_secret` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `api_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `level` tinyint(4) NOT NULL DEFAULT 2,
  `welcomed` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`),
  UNIQUE KEY `users_api_key_unique` (`api_key`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_remember_token_index` (`remember_token`),
  KEY `users_active_index` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'cachet'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2019-07-13 20:06:28


-- ACTUAL USER INPUTTED VALUES
INSERT INTO cachet.component_groups (name,`order`,visible,collapsed,created_at,updated_at) VALUES 
('API',0,1,0,'2019-06-30 17:21:15.000','2019-06-30 17:21:15.000')
,('Other own services',0,1,0,'2019-06-30 17:21:32.000','2019-06-30 17:22:03.000')
,('Cloud services',0,1,0,'2019-06-30 17:22:18.000','2019-06-30 17:22:18.000')
;

INSERT INTO cachet.components (name,description,link,status,`order`,group_id,enabled,meta,created_at,updated_at,deleted_at) VALUES 
('Core','The API providing members login and membership (in the future, only the membership)','',1,0,1,1,NULL,'2019-06-30 17:23:15.000','2019-06-30 17:23:15.000',NULL)
,('Events','The API providing members with events','',1,0,1,1,NULL,'2019-06-30 17:23:39.000','2019-06-30 17:23:39.000',NULL)
,('Statutory','The API providing members with the statutory events to apply to. In future, also voting','',1,0,1,1,NULL,'2019-06-30 17:24:16.000','2019-06-30 17:24:16.000',NULL)
,('Auth0','In the future, we will login through that','https://status.auth0.com/',0,0,3,1,NULL,'2019-06-30 17:24:34.000','2019-06-30 17:25:02.000',NULL)
,('Discounts','The API providing members with the discount codes coming from our partnerships','https://my.aegee.eu/discounts',1,0,1,1,NULL,'2019-06-30 17:26:21.000','2019-06-30 17:26:21.000',NULL)
,('Gsuite-wrapper','The API that link our system with Gsuite API','',1,0,1,1,NULL,'2019-06-30 17:27:01.000','2019-06-30 17:27:01.000',NULL)
,('Wiki','Our self-hosted knowledge management','https://wiki.aegee.eu',4,0,2,1,NULL,'2019-06-30 17:28:00.000','2019-06-30 17:29:29.000',NULL)
,('Website','The website of the organisation','https://www.aegee.eu',1,0,2,1,NULL,'2019-06-30 17:28:42.000','2019-06-30 17:28:42.000',NULL)
,('Forum','Where discussions happen','https://forum.aegee.eu',4,0,2,1,NULL,'2019-06-30 17:29:21.000','2019-06-30 17:33:39.000',NULL)
,('Survey','Where members make surveys for impact management or anything','https://survey.aegee.eu',4,0,2,1,NULL,'2019-06-30 17:30:06.000','2019-06-30 17:33:30.000',NULL)
;
INSERT INTO cachet.components (name,description,link,status,`order`,group_id,enabled,meta,created_at,updated_at,deleted_at) VALUES 
('Gsuite','The Gsuite API and services','https://www.google.com/appsstatus',1,0,3,1,NULL,'2019-06-30 17:31:21.000','2019-06-30 17:31:21.000',NULL)
,('Podio','We use it for too many things','https://status.podio.com/',1,0,3,1,NULL,'2019-06-30 17:32:01.000','2019-06-30 17:32:01.000',NULL)
,('Helpdesk','Where AEGEEans can ask their questions for support','https://status.atlassian.com/',1,0,3,1,NULL,'2019-06-30 17:33:04.000','2019-06-30 17:33:04.000',NULL)
;

INSERT INTO cachet.settings (name,value,created_at,updated_at) VALUES 
('app_name','AEGEE Staging statuspage','2019-06-20 10:02:45.000','2019-06-21 11:50:52.000')
,('app_domain','https://status.staging.barnab.eu','2019-06-20 10:02:45.000','2019-06-20 14:08:20.000')
,('app_timezone','UTC','2019-06-20 10:02:45.000','2019-06-21 13:36:52.000')
,('app_locale','en','2019-06-20 10:02:45.000','2019-06-20 10:02:45.000')
,('app_incident_days','3','2019-06-20 10:02:45.000','2019-06-20 10:08:20.000')
,('app_refresh_rate','60','2019-06-20 10:02:45.000','2019-06-21 11:50:53.000')
,('app_banner_type','image/png','2019-06-20 10:03:22.000','2019-06-21 13:25:53.000')
,('style_background_color','#f0f3f4','2019-06-20 10:03:22.000','2019-06-20 10:03:22.000')
,('style_text_color','#333333','2019-06-20 10:03:22.000','2019-06-20 10:03:22.000')
,('style_banner_background_color','','2019-06-20 10:03:22.000','2019-06-20 10:03:22.000')
;
INSERT INTO cachet.settings (name,value,created_at,updated_at) VALUES 
('style_banner_padding','40px 0','2019-06-20 10:03:22.000','2019-06-20 10:03:22.000')
,('style_fullwidth_header','0','2019-06-20 10:03:22.000','2019-06-20 10:03:22.000')
,('style_reds','#ff6f6f','2019-06-20 10:03:22.000','2019-06-20 10:03:22.000')
,('style_blues','#3498db','2019-06-20 10:03:22.000','2019-06-20 10:03:22.000')
,('style_greens','#7ed321','2019-06-20 10:03:22.000','2019-06-20 10:03:22.000')
,('style_yellows','#f7ca18','2019-06-20 10:03:23.000','2019-06-20 10:03:23.000')
,('style_oranges','#ff8800','2019-06-20 10:03:23.000','2019-06-20 10:03:23.000')
,('style_metrics','#0dccc0','2019-06-20 10:03:23.000','2019-06-20 10:03:23.000')
,('style_links','#7ed321','2019-06-20 10:03:23.000','2019-06-20 10:03:23.000')
,('style_background_fills','#ffffff','2019-06-20 10:03:23.000','2019-06-20 10:03:23.000')
;
INSERT INTO cachet.settings (name,value,created_at,updated_at) VALUES 
('dashboard_login_link','1','2019-06-20 10:03:23.000','2019-06-20 10:03:23.000')
,('app_about','This page provides status information on the services that are part of **AEGEE-Europe**''s infrastructure.','2019-06-20 10:08:20.000','2019-06-21 12:09:29.000')
,('major_outage_rate','50','2019-06-20 10:08:20.000','2019-06-20 10:08:20.000')
,('enable_subscribers','1','2019-06-20 10:08:20.000','2019-06-20 10:08:20.000')
,('suppress_notifications_in_maintenance','1','2019-06-20 10:08:20.000','2019-06-20 10:08:20.000')
,('skip_subscriber_verification','0','2019-06-20 10:08:20.000','2019-06-20 10:08:20.000')
,('display_graphs','0','2019-06-20 10:08:20.000','2019-06-21 14:53:58.000')
,('show_support','0','2019-06-20 10:08:20.000','2019-06-20 10:08:20.000')
,('enable_external_dependencies','1','2019-06-20 10:08:20.000','2019-06-20 10:08:20.000')
,('show_timezone','1','2019-06-20 10:08:20.000','2019-06-20 10:08:20.000')
;
INSERT INTO cachet.settings (name,value,created_at,updated_at) VALUES 
('only_disrupted_days','1','2019-06-20 10:08:20.000','2019-06-20 10:08:20.000')
,('always_authenticate','0','2019-06-20 13:53:34.000','2019-06-20 13:53:39.000')
,('allowed_domains','','2019-06-20 13:53:34.000','2019-06-20 13:53:34.000')
,('stylesheet','.banner-image {
    margin: 0 auto;
    height: 100px;
}
body.status-page .app-banner {
    margin-bottom: 0px;
}
body.tooltip {
    background: #fff;
    border: 1px dashed #999
}','2019-06-21 13:30:39.000','2019-06-28 07:49:58.000')
,('date_format','l jS F Y','2019-06-21 13:36:52.000','2019-06-21 13:36:52.000')
,('incident_date_format','l jS F Y H:i:s','2019-06-21 13:36:52.000','2019-06-21 13:36:52.000')
,('automatic_localization','0','2019-06-21 13:36:52.000','2019-06-21 13:36:52.000')
,('app_banner','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','2019-06-30 17:20:54.000','2019-06-30 17:20:54.000')
;

INSERT INTO cachet.users (username,password,remember_token,google_2fa_secret,email,api_key,active,`level`,welcomed,created_at,updated_at) VALUES 
('admin','$2y$10$gPQyKocNZxq.K5IrzGQjvObEQFLXCBwaGJSjkn5g.ia1ezAoilKN6',NULL,NULL,'admin@test.test','YGVG5xddoFOeQBI8xcNp',1,1,0,'2019-07-13 18:22:17.000','2019-07-13 18:22:17.000')
;
